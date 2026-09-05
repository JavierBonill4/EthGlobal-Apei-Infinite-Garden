// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Garden} from "../src/Garden.sol";
import {MockRandomness} from "../src/randomness/MockRandomness.sol";
import {WaterCurve} from "../src/libraries/WaterCurve.sol";
import {Decay} from "../src/libraries/Decay.sol";
import {OfflineMode, SeasonOutcome} from "../src/interfaces/IGarden.sol";

/// @notice These test the properties that make this a dilemma rather than a
///         farming sim. If one starts failing, a DESIGN property has broken,
///         not just an implementation detail -- read the comment before you
///         "fix" the test.
contract GardenTest is Test {
    Garden internal garden;
    MockRandomness internal rng;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCAFE);

    uint256 internal constant STAKE = 0.001 ether;

    function setUp() public {
        rng = new MockRandomness();
        garden = new Garden(address(rng), block.timestamp + 1 hours, 10_000, 800, 50);
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.deal(carol, 1 ether);
    }

    function _startWithThree() internal {
        vm.prank(alice);
        garden.joinQueue{value: STAKE}();
        vm.prank(bob);
        garden.joinQueue{value: STAKE}();
        vm.prank(carol);
        garden.joinQueue{value: STAKE}();

        vm.warp(block.timestamp + 2 hours);
        garden.startSeason();
    }

    function _requirement() internal view returns (uint16 req) {
        (,,,,, req,) = garden.season();
    }

    function _activePlots() internal view returns (uint32 n) {
        (,, n,,,,) = garden.season();
    }

    function _wellLevel() internal view returns (uint32 lvl) {
        (, lvl,) = garden.well();
    }

    // -----------------------------------------------------------------
    // The curve: why calculated greed is self-limiting and panic is not
    // -----------------------------------------------------------------

    function test_waterCurve_isFlatBeyondHardCap() public pure {
        uint32 atHard = WaterCurve.effective(250);
        assertEq(WaterCurve.effective(400), atHard, "draws past HARD_CAP must credit nothing extra");
        assertEq(WaterCurve.effective(10_000), atHard, "the curve must stay flat forever");
    }

    function test_waterCurve_isLinearBelowSoftCap() public pure {
        assertEq(WaterCurve.effective(0), 0);
        assertEq(WaterCurve.effective(50), 50);
        assertEq(WaterCurve.effective(100), 100);
    }

    /// @dev THE tragedy-of-the-commons asymmetry: the plot is credited on a
    ///      flattening curve, the well is always debited face value. If this
    ///      ever stops holding, the game stops being about a commons.
    function test_wellPaysFaceValueEvenWhenThePlotGainsNothing() public {
        _startWithThree();

        uint32 levelBefore = _wellLevel();

        vm.prank(alice);
        garden.drawWater(1, 250); // exactly the point of no benefit

        uint32 levelMid = _wellLevel();
        assertEq(levelBefore - levelMid, 250);

        vm.prank(alice);
        garden.drawWater(1, 500); // pure waste for alice, real cost to everyone

        assertEq(levelMid - _wellLevel(), 500, "the well must be debited in full for a useless draw");
    }

    // -----------------------------------------------------------------
    // Timing: the requirement must not be knowable while draws are open
    // -----------------------------------------------------------------

    function test_requirementIsOnlyKnownAfterDrawsAreLocked() public {
        _startWithThree();
        assertEq(_requirement(), 0, "no requirement should exist mid-epoch");

        vm.prank(alice);
        garden.drawWater(1, 80);

        vm.warp(block.timestamp + 1 days);
        garden.settleBegin();

        assertEq(_requirement(), 0, "still unknown: the word has not arrived yet");

        rng.fulfil(1, 0);
        assertEq(_requirement(), garden.REQ_MIN());
    }

    function test_requirementAlwaysLandsOnABucketBoundary(uint256 word) public {
        _startWithThree();
        vm.warp(block.timestamp + 1 days);

        garden.settleBegin();
        rng.fulfil(1, word);

        uint16 req = _requirement();
        assertGe(req, garden.REQ_MIN());
        assertLe(req, garden.REQ_MAX());
        assertEq((req - garden.REQ_MIN()) % garden.REQ_STEP(), 0, "must be bucket-aligned or the count is inexact");
    }

    /// @dev A plot that drew exactly the requirement met it. Off-by-one here
    ///      would quietly kill plots that did everything right.
    function test_meetingTheRequirementExactlyCounts() public {
        _startWithThree();

        vm.prank(alice);
        garden.drawWater(1, 40);

        vm.warp(block.timestamp + 1 days);
        garden.settleBegin();

        vm.expectEmit(true, false, false, false);
        emit Garden.EpochSettled(1, 40, 0, 1, 2);
        rng.fulfil(1, 4); // REQ_MIN + 4*REQ_STEP = 40
    }

    // -----------------------------------------------------------------
    // Lazy decay, and why logging off is not immortality
    // -----------------------------------------------------------------

    function test_decayIsLazyAndTracksElapsedEpochs() public {
        _startWithThree();

        (uint16 w0,) = garden.healthOf(1);
        vm.warp(block.timestamp + 3 days);
        (uint16 w3,) = garden.healthOf(1);

        assertEq(w3, w0 - (Decay.NORMAL * 3), "three untended epochs, three doses");
    }

    function test_offlineInstructionExpiresAfterItsGrace() public {
        _startWithThree();

        vm.prank(alice);
        garden.setOfflineMode(1, OfflineMode.WorkPlot);
        uint16 start = garden.HEALTH_MAX() / 2;

        // Inside the grace window: the slow rate.
        vm.warp(block.timestamp + 2 days);
        (uint16 wSlow,) = garden.healthOf(1);
        assertEq(wSlow, start - (Decay.SLOW * 2));

        // Past it: the tail is charged at the normal rate, so a standing
        // instruction buys a week, not permanent protection. Abandonment has
        // to stay a real failure mode.
        vm.warp(block.timestamp + 6 days); // epoch 8 total
        (uint16 wLater,) = garden.healthOf(1);
        uint32 expectedLoss = (Decay.GRACE_EPOCHS * Decay.SLOW) + (1 * Decay.NORMAL);
        assertEq(wLater, uint16(start - expectedLoss), "grace must expire");
    }

    // -----------------------------------------------------------------
    // The stake: clean exit refunds, dormancy forfeits
    // -----------------------------------------------------------------

    function test_cedeRefundsTheStake() public {
        _startWithThree();

        uint256 before = alice.balance;
        vm.prank(alice);
        garden.cede(1, address(0xD00D));

        assertEq(alice.balance, before + STAKE, "a clean exit gets the stake back");
    }

    function test_dormancyForfeitsIntoTheStewardshipPool() public {
        _startWithThree();
        vm.warp(block.timestamp + (uint256(Decay.GRACE_EPOCHS) * 2 + 1) * 1 days);

        uint256 poolBefore = garden.stewardshipPool();
        garden.revertToWilderness(1);

        assertEq(garden.stewardshipPool(), poolBefore + STAKE, "the cleanup is funded by whoever left");
        assertEq(_activePlots(), 2, "area must shrink with the community");
    }

    function test_cannotRevertAPlotSomeoneIsStillTending() public {
        _startWithThree();
        vm.warp(block.timestamp + 2 days);

        vm.expectRevert();
        garden.revertToWilderness(1);
    }

    function test_wildernessCanBeClaimedByANewcomer() public {
        _startWithThree();
        vm.warp(block.timestamp + (uint256(Decay.GRACE_EPOCHS) * 2 + 1) * 1 days);
        garden.revertToWilderness(1);

        address dave = address(0xDA7E);
        vm.deal(dave, 1 ether);
        vm.prank(dave);
        garden.claimWilderness{value: STAKE}(1);

        assertEq(_activePlots(), 3, "rolling entry happens through wilderness, not the queue");
    }

    // -----------------------------------------------------------------
    // Settlement is permissionless and its outcome cannot be dodged
    // -----------------------------------------------------------------

    function test_settlementCannotBeStartedTwice() public {
        _startWithThree();
        vm.warp(block.timestamp + 1 days);

        garden.settleBegin();
        vm.expectRevert(Garden.SettlementInFlight.selector);
        garden.settleBegin();
    }

    function test_onlyTheRandomnessSourceCanFinalise() public {
        _startWithThree();
        vm.warp(block.timestamp + 1 days);
        garden.settleBegin();

        vm.prank(alice);
        vm.expectRevert(Garden.NotRandomnessSource.selector);
        garden.onRandomness(1, 12345);
    }

    function test_cannotSettleAnEpochThatHasNotEndedYet() public {
        _startWithThree();
        vm.expectRevert(Garden.TooEarly.selector);
        garden.settleBegin();
    }
}
