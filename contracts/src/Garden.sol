// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Epoch} from "./libraries/Epoch.sol";
import {Decay} from "./libraries/Decay.sol";
import {WaterCurve} from "./libraries/WaterCurve.sol";
import {Well} from "./Well.sol";
import {Farm} from "./Farm.sol";
import {IRandomnessSource, IRandomnessConsumer} from "./interfaces/IRandomnessSource.sol";
import {
    IGardenEvents, Plot, PlotStatus, OfflineMode, SeasonState, SeasonOutcome
} from "./interfaces/IGarden.sol";

/// @title Garden
/// @notice Core world state for one season of the Garden.
///
/// THE CENTRAL MECHANIC
/// --------------------
/// Every epoch, each plot must have received at least `x` units of water
/// health to stay healthy. `x` is rolled from a PUBLIC range but only AFTER
/// every draw for that epoch is locked. So:
///
///   draw too little  -> you may miss x and your plot decays
///   draw defensively -> the well empties and EVERYONE misses x
///
/// The corridor in the design doc is not authored here, it emerges from that.
/// There is no hidden constant anywhere in this contract -- the range, the
/// curve and the thresholds are all public and auditable. Only the roll is
/// unknown, and only until settlement. Hide the roll, not the rules.
///
/// GAS SHAPE
/// ---------
/// Nothing iterates over plots. Decay is lazy (computed on read from
/// `lastTendedEpoch`). The count of plots that met the requirement is derived
/// at settlement from a bucketed histogram in O(BUCKETS), and `x` is always
/// rolled onto a bucket boundary so the count is exact rather than approximate.
contract Garden is IGardenEvents, IRandomnessConsumer {
    using Well for Well.State;
    using Farm for Farm.State;

    // ---------------------------------------------------------------------
    // Public parameters. All of these are deliberately readable by anyone.
    // ---------------------------------------------------------------------

    uint16 public constant HEALTH_MAX = 1000;

    /// @dev The requirement range. PUBLIC BY DESIGN -- players must be able to
    ///      reason about the odds. Only the draw itself is unknown.
    uint16 public constant REQ_MIN = 20;
    uint16 public constant REQ_MAX = 80;
    uint16 public constant REQ_STEP = 5;
    uint8 public constant BUCKETS = 14; // 1..12 in-range, 13 = at/above REQ_MAX

    /// @dev Nutrient health a plot must hold for the world to count it toward
    ///      level completion. This is the stagnation floor: a world where
    ///      nobody buys nutrients cannot advance, however careful it is.
    uint16 public constant NUTRIENT_FLOOR = 300;

    /// @dev Well must stay above this fraction of capacity for an epoch to
    ///      count as healthy.
    uint16 public constant WELL_FLOOR_BPS = 2_000;

    /// @dev Refundable entry stake. Sybil toll, exit incentive and the
    ///      stewardship pool's funding, all in one primitive.
    uint256 public constant STAKE = 0.001 ether;

    /// @dev Paid to whoever advances the world. Settlement is permissionless
    ///      so it always gets called.
    uint256 public constant SETTLE_BOUNTY = 0.0001 ether;

    /// @dev A season that never completes eventually times out. Stagnation is
    ///      a quieter failure than depletion, on purpose.
    uint32 public constant MAX_EPOCHS = 120;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    IRandomnessSource public immutable randomness;

    uint256 public genesis; // season start timestamp; 0 until started
    uint256 public kickoffTime; // when startSeason() becomes callable

    SeasonState public season;
    Well.State public well;
    Farm.State public farm;

    uint256 public stewardshipPool;
    uint256 public nextPlotId = 1;

    mapping(uint256 => Plot) public plots;
    mapping(address => uint256) public plotOf; // one plot per address at entry

    /// @dev epoch => bucket => count of plots whose credited water is in it.
    ///      Bucket 0 is never written: plots that did nothing are derived as
    ///      `activePlots - sum(buckets)`.
    mapping(uint32 => uint32[BUCKETS]) private _histogram;

    /// @dev epoch => plots that were above NUTRIENT_FLOOR when they acted.
    mapping(uint32 => uint32) public nutrientFloorMet;

    /// @dev epoch => plots that took any action at all.
    mapping(uint32 => uint32) public tendedIn;

    /// @dev Set while a settlement request is in flight.
    uint256 public pendingRequestId;
    uint32 public pendingEpoch;

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotStarted();
    error AlreadyStarted();
    error SeasonOver();
    error WrongStake(uint256 sent, uint256 expected);
    error AlreadyJoined();
    error NotYours(uint256 plotId);
    error PlotNotActive(uint256 plotId);
    error TooEarly();
    error SettlementInFlight();
    error NoSettlementPending();
    error NotRandomnessSource();
    error PlotStillTended(uint256 plotId);

    constructor(address randomness_, uint256 kickoffTime_, uint32 wellCapacity, uint32 wellRefill, uint32 farmBase) {
        randomness = IRandomnessSource(randomness_);
        kickoffTime = kickoffTime_;
        well.init(wellCapacity, wellRefill);
        farm.init(farmBase);
        season.level = 1;
        season.outcome = SeasonOutcome.Running;
    }

    // ---------------------------------------------------------------------
    // Joining
    // ---------------------------------------------------------------------

    /// @notice Stake in before kickoff. Everyone in the queue starts together.
    /// @dev Cohort entry is deliberate: a shared season with a clear start is
    ///      what makes "we reached level 4 together" mean anything. Latecomers
    ///      enter through claimWilderness() instead, which doubles as the
    ///      stewardship mechanic.
    function joinQueue() external payable {
        if (genesis != 0) revert AlreadyStarted();
        if (msg.value != STAKE) revert WrongStake(msg.value, STAKE);
        if (plotOf[msg.sender] != 0) revert AlreadyJoined();

        uint256 id = nextPlotId++;
        Plot storage p = plots[id];
        p.owner = msg.sender;
        p.status = PlotStatus.Queued;
        p.waterHealth = HEALTH_MAX / 2;
        p.nutrientHealth = HEALTH_MAX / 2;
        plotOf[msg.sender] = id;

        emit PlotClaimed(id, msg.sender);
    }

    /// @notice Begin the season. Permissionless once the timer has run out.
    function startSeason() external {
        if (genesis != 0) revert AlreadyStarted();
        if (block.timestamp < kickoffTime) revert TooEarly();

        genesis = block.timestamp;
        uint32 count = uint32(nextPlotId - 1);

        // TODO(mechanics): apply the player-count band here (1-10, 11-100,
        // 101-1000). Bands change requiredStreak and healthyBps, not the
        // resource curves. See docs/MECHANICS.md for the table.
        for (uint256 i = 1; i <= count; i++) {
            Plot storage p = plots[i];
            p.status = PlotStatus.Active;
            p.joinedEpoch = 0;
            p.lastTendedEpoch = 0;
        }
        season.activePlots = count;

        emit SeasonStarted(season.level, genesis, count);
    }

    /// @notice Take over a plot that reverted to wilderness. This is how
    ///         players join a season already in progress.
    function claimWilderness(uint256 plotId) external payable {
        _requireRunning();
        if (msg.value != STAKE) revert WrongStake(msg.value, STAKE);
        if (plotOf[msg.sender] != 0) revert AlreadyJoined();

        Plot storage p = plots[plotId];
        if (p.status != PlotStatus.Wilderness) revert PlotNotActive(plotId);

        uint32 e = currentEpoch();
        p.owner = msg.sender;
        p.steward = address(0);
        p.status = PlotStatus.Active;
        p.joinedEpoch = e;
        p.lastTendedEpoch = e;
        p.waterHealth = HEALTH_MAX / 4; // wilderness is a fixer-upper
        p.nutrientHealth = HEALTH_MAX / 4;
        p.offline = OfflineMode.None;
        p.actedMarker = 0;
        p.nutrientMarker = 0;
        p.drawnThisEpoch = 0;
        plotOf[msg.sender] = plotId;

        season.activePlots += 1;
        emit PlotClaimed(plotId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Player actions
    // ---------------------------------------------------------------------

    /// @notice Draw raw units from the well.
    /// @dev The well is debited `amount`. The plot is credited
    ///      WaterCurve.effective(amount), which flattens to zero marginal
    ///      benefit. `forborne` in the event is the headline UI number.
    function drawWater(uint256 plotId, uint32 amount) external {
        _requireRunning();
        Plot storage p = _authed(plotId);
        uint32 e = currentEpoch();
        _syncPlot(p, e);

        // _syncPlot has already zeroed this if we crossed into a new epoch.
        uint32 before = p.drawnThisEpoch;
        uint32 after_ = before + amount;

        well.draw(amount);

        p.drawnThisEpoch = after_;

        uint32 creditedBefore = WaterCurve.effective(before);
        uint32 creditedAfter = WaterCurve.effective(after_);
        _rebucket(e, creditedBefore, creditedAfter, before == 0);

        uint32 gained = creditedAfter - creditedBefore;
        uint32 newHealth = p.waterHealth + gained;
        p.waterHealth = newHealth > HEALTH_MAX ? HEALTH_MAX : uint16(newHealth);

        uint32 entitled = WaterCurve.pointOfNoBenefit();
        uint32 forborne = after_ >= entitled ? 0 : entitled - after_;

        emit WaterDrawn(plotId, msg.sender, e, amount, forborne);
    }

    /// @notice Buy nutrients from the communal farm.
    /// @dev TODO(economy): price this in the gold/jewels resource from the
    ///      challenge loop rather than making it free. See docs/MECHANICS.md.
    function buyNutrients(uint256 plotId, uint32 amount) external {
        _requireRunning();
        Plot storage p = _authed(plotId);
        uint32 e = currentEpoch();
        _syncPlot(p, e);

        farm.buy(amount);

        uint32 newHealth = p.nutrientHealth + amount;
        p.nutrientHealth = newHealth > HEALTH_MAX ? HEALTH_MAX : uint16(newHealth);

        _creditNutrientFloor(p, e);
        emit NutrientsBought(plotId, e, amount);
    }

    /// @notice Give seeds to the farm instead of keeping them for your plot.
    /// @dev Wasted entirely if the epoch's total stays under
    ///      Farm.COORDINATION_THRESHOLD. That is the point.
    function contributeSeeds(uint256 plotId, uint32 amount) external {
        _requireRunning();
        Plot storage p = _authed(plotId);
        uint32 e = currentEpoch();
        _syncPlot(p, e);

        // TODO(economy): debit the player's seed inventory once the challenge
        // loop exists. Today seeds are unmetered.
        farm.contributeSeeds(amount);

        emit SeedsContributed(plotId, e, amount);
    }

    /// @notice Leave a standing instruction before logging off.
    function setOfflineMode(uint256 plotId, OfflineMode mode) external {
        _requireRunning();
        Plot storage p = _authed(plotId);
        _syncPlot(p, currentEpoch());
        p.offline = mode;
        if (mode == OfflineMode.WorkFarm) farm.addLabour(1);
        emit OfflineModeSet(plotId, mode);
    }

    /// @notice Hand your plot to a specific player and recover your stake.
    /// @dev A clean exit. Contrast with going dormant, which forfeits.
    function cede(uint256 plotId, address to) external {
        Plot storage p = plots[plotId];
        if (p.owner != msg.sender) revert NotYours(plotId);
        if (plotOf[to] != 0) revert AlreadyJoined();

        plotOf[msg.sender] = 0;
        plotOf[to] = plotId;
        p.owner = to;
        p.steward = address(0);

        emit PlotCeded(plotId, msg.sender, to);
        _refund(msg.sender);
    }

    /// @notice Tend a plot that is not yours. Pays its yield, charges its decay.
    /// @dev After ADOPTION_MERGE_EPOCHS consecutive tended epochs it should
    ///      merge into the steward's holding.
    ///      TODO(mechanics): implement the merge and the yield split.
    function adopt(uint256 plotId) external {
        _requireRunning();
        Plot storage p = plots[plotId];
        if (p.status != PlotStatus.Active) revert PlotNotActive(plotId);
        p.steward = msg.sender;
        emit PlotAdopted(plotId, msg.sender);
    }

    /// @notice Revert a plot nobody has tended in a long time to wilderness.
    ///         Area and decay burden both leave the world with it.
    function revertToWilderness(uint256 plotId) external {
        _requireRunning();
        Plot storage p = plots[plotId];
        if (p.status != PlotStatus.Active) revert PlotNotActive(plotId);

        uint32 e = currentEpoch();
        if (e - p.lastTendedEpoch < Decay.GRACE_EPOCHS * 2) revert PlotStillTended(plotId);

        address owner = p.owner;
        p.status = PlotStatus.Wilderness;
        p.owner = address(0);
        p.steward = address(0);
        plotOf[owner] = 0;
        season.activePlots -= 1;

        // Dormant exit forfeits the stake into the pool that pays the people
        // who clean up after you.
        stewardshipPool += STAKE;

        emit PlotReverted(plotId);
    }

    // ---------------------------------------------------------------------
    // Settlement -- two phase, and the order matters
    // ---------------------------------------------------------------------

    /// @notice Phase one. Locks the epoch and requests the roll.
    /// @dev Permissionless and bounty-paid so it always happens. Because the
    ///      caller cannot see the word before committing, they cannot decline
    ///      to settle an epoch whose outcome they dislike -- which is exactly
    ///      why this is VRF and not block.prevrandao.
    function settleBegin() external {
        _requireRunning();
        if (pendingRequestId != 0) revert SettlementInFlight();

        uint32 e = currentEpoch();
        if (e <= season.epoch) revert TooEarly();

        pendingEpoch = season.epoch + 1;
        pendingRequestId = randomness.requestRandomness();

        emit SettlementRequested(pendingEpoch, pendingRequestId);
    }

    /// @notice Phase two. Called back by the randomness source.
    function onRandomness(uint256 requestId, uint256 word) external {
        if (msg.sender != address(randomness)) revert NotRandomnessSource();
        if (requestId != pendingRequestId || pendingRequestId == 0) revert NoSettlementPending();

        uint32 e = pendingEpoch;
        pendingRequestId = 0;

        // Roll the requirement onto a bucket boundary so the histogram count
        // below is exact rather than approximate.
        uint16 steps = uint16((REQ_MAX - REQ_MIN) / REQ_STEP);
        uint16 requirement = REQ_MIN + uint16(word % (steps + 1)) * REQ_STEP;

        (uint32 met, uint32 missed) = _countAgainst(e, requirement);

        well.refill();
        farm.produce();

        season.epoch = e;
        season.lastRequirement = requirement;
        season.tendedLastEpoch = tendedIn[e];

        bool healthy = _isHealthyEpoch(e, met);
        season.consecutiveHealthyEpochs = healthy ? season.consecutiveHealthyEpochs + 1 : 0;

        emit EpochSettled(e, requirement, well.level, met, missed);

        _evaluateSeason(e, word);
        _payBounty(msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function currentEpoch() public view returns (uint32) {
        if (genesis == 0) return 0;
        return Epoch.current(genesis);
    }

    /// @notice Health as of right now, with lazy decay applied.
    function healthOf(uint256 plotId) external view returns (uint16 water, uint16 nutrient) {
        Plot storage p = plots[plotId];
        uint32 e = currentEpoch();
        uint32 elapsed = e > p.lastTendedEpoch ? e - p.lastTendedEpoch : 0;
        bool instruction = p.offline == OfflineMode.WorkPlot;
        water = Decay.apply_(p.waterHealth, elapsed, instruction);
        nutrient = Decay.apply_(p.nutrientHealth, elapsed, instruction);
    }

    function histogram(uint32 epoch) external view returns (uint32[BUCKETS] memory) {
        return _histogram[epoch];
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requireRunning() internal view {
        if (genesis == 0) revert NotStarted();
        if (season.outcome != SeasonOutcome.Running) revert SeasonOver();
    }

    function _authed(uint256 plotId) internal view returns (Plot storage p) {
        p = plots[plotId];
        if (p.status != PlotStatus.Active) revert PlotNotActive(plotId);
        if (p.owner != msg.sender && p.steward != msg.sender) revert NotYours(plotId);
    }

    /// @dev Fold accrued decay into stored health, advance the accounting
    ///      marker, and count the plot as having acted this epoch. Called at
    ///      the top of every player action.
    ///
    ///      Note `lastTendedEpoch` is an ACCOUNTING marker, not a reward: this
    ///      advances it because the decay it represents has now been applied.
    ///      Whether the plot is in good shape is a separate question, answered
    ///      by its health values.
    function _syncPlot(Plot storage p, uint32 e) internal {
        uint32 elapsed = e > p.lastTendedEpoch ? e - p.lastTendedEpoch : 0;
        if (elapsed > 0) {
            bool instruction = p.offline == OfflineMode.WorkPlot;
            p.waterHealth = Decay.apply_(p.waterHealth, elapsed, instruction);
            p.nutrientHealth = Decay.apply_(p.nutrientHealth, elapsed, instruction);
            p.lastTendedEpoch = e;
        }
        if (p.actedMarker != e + 1) {
            p.actedMarker = e + 1;
            p.drawnThisEpoch = 0;
            tendedIn[e] += 1;
        }
    }

    /// @dev Counted at most once per plot per epoch.
    function _creditNutrientFloor(Plot storage p, uint32 e) internal {
        if (p.nutrientHealth >= NUTRIENT_FLOOR && p.nutrientMarker != e + 1) {
            p.nutrientMarker = e + 1;
            nutrientFloorMet[e] += 1;
        }
    }

    /// @dev Move a plot between histogram buckets as its credited water grows.
    function _rebucket(uint32 e, uint32 creditedBefore, uint32 creditedAfter, bool firstDraw) internal {
        uint8 to = _bucketOf(creditedAfter);
        if (!firstDraw) {
            uint8 from = _bucketOf(creditedBefore);
            if (from == to) return;
            if (from > 0) _histogram[e][from] -= 1;
        }
        if (to > 0) _histogram[e][to] += 1;
    }

    /// @dev Bucket 0 means "below REQ_MIN", never stored. Bucket BUCKETS-1
    ///      means "at or above REQ_MAX", always meets.
    function _bucketOf(uint32 credited) internal pure returns (uint8) {
        if (credited < REQ_MIN) return 0;
        if (credited >= REQ_MAX) return uint8(BUCKETS - 1);
        return uint8(1 + ((credited - REQ_MIN) / REQ_STEP));
    }

    /// @dev Exact because `requirement` is always on a bucket boundary.
    function _countAgainst(uint32 e, uint16 requirement) internal view returns (uint32 met, uint32 missed) {
        uint32[BUCKETS] storage h = _histogram[e];
        for (uint8 b = 1; b < BUCKETS; b++) {
            uint32 lo = b == BUCKETS - 1 ? REQ_MAX : REQ_MIN + (uint32(b) - 1) * REQ_STEP;
            if (lo >= requirement) met += h[b];
        }
        uint32 active = season.activePlots;
        missed = active > met ? active - met : 0;
    }

    function _isHealthyEpoch(uint32 e, uint32 met) internal view returns (bool) {
        uint32 active = season.activePlots;
        if (active == 0) return false;
        if (well.levelBps() < WELL_FLOOR_BPS) return false;

        // TODO(mechanics): pull healthyBps from the player-count band table.
        uint32 metBps = (met * 10_000) / active;
        uint32 nutrientBps = (nutrientFloorMet[e] * 10_000) / active;
        return metBps >= 6_000 && nutrientBps >= 6_000;
    }

    /// @dev Two failure shapes, deliberately different. Depletion is a roll
    ///      against a rising hazard. Stagnation is a timeout -- quieter, and a
    ///      genuinely different thing to explain to your community afterwards.
    function _evaluateSeason(uint32 e, uint256 word) internal {
        // TODO(mechanics): requiredStreak comes from the band table.
        if (season.consecutiveHealthyEpochs >= 10) {
            season.outcome = SeasonOutcome.Completed;
            emit SeasonEnded(season.level, SeasonOutcome.Completed, e);
            return;
        }

        if (e >= MAX_EPOCHS) {
            season.outcome = SeasonOutcome.CollapsedStagnation;
            emit SeasonEnded(season.level, SeasonOutcome.CollapsedStagnation, e);
            return;
        }

        uint16 hazardBps = _hazard();
        if (hazardBps > 0 && uint16((word >> 128) % 10_000) < hazardBps) {
            season.outcome = SeasonOutcome.CollapsedDepletion;
            emit SeasonEnded(season.level, SeasonOutcome.CollapsedDepletion, e);
        }
    }

    /// @notice Collapse probability this epoch, in basis points. PUBLIC.
    /// @dev Players can compute their exact odds. What they cannot know is the
    ///      roll. TODO(mechanics): fold in neglect, area-vs-labour and voting
    ///      concentration; today this is well level only.
    function _hazard() internal view returns (uint16) {
        uint16 lvl = well.levelBps();
        if (lvl >= WELL_FLOOR_BPS) return 0;
        // Linear ramp from 0 at the floor to 4000bps at an empty well.
        uint256 shortfall = uint256(WELL_FLOOR_BPS - lvl);
        return uint16((shortfall * 4_000) / WELL_FLOOR_BPS);
    }

    function _refund(address to) internal {
        (bool ok,) = payable(to).call{value: STAKE}("");
        require(ok, "refund failed");
    }

    function _payBounty(address to) internal {
        if (stewardshipPool < SETTLE_BOUNTY) return;
        stewardshipPool -= SETTLE_BOUNTY;
        (bool ok,) = payable(to).call{value: SETTLE_BOUNTY}("");
        require(ok, "bounty failed");
    }

    receive() external payable {
        stewardshipPool += msg.value;
    }
}
