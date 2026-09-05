// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Lifecycle of a single plot.
enum PlotStatus {
    None, // never claimed
    Queued, // staked, waiting for the season to begin
    Active, // in play
    Wilderness // reverted; area and burden both removed
}

/// @notice A standing instruction left behind when a player logs off.
///         Absence is a choice with a cost, not pure damage -- but see
///         Decay.GRACE_EPOCHS, these expire.
enum OfflineMode {
    None,
    WorkPlot, // slower decay on your own plot
    WorkFarm // contributes labour to communal nutrient production
}

/// @notice How a season ended. Depletion is a roll; Stagnation is a timeout.
///         They are deliberately different shapes of failure.
enum SeasonOutcome {
    Running,
    Completed,
    CollapsedDepletion,
    CollapsedStagnation
}

struct Plot {
    address owner;
    address steward; // non-zero while adopted by someone else
    uint32 joinedEpoch;
    /// @dev The epoch through which decay has been ACCOUNTED, not the last
    ///      epoch the plot was cared for. Lazy decay reads from this.
    uint32 lastTendedEpoch;
    /// @dev epoch + 1 of the plot's last action; 0 means never acted. The +1
    ///      offset exists so epoch 0 is distinguishable from "never".
    uint32 actedMarker;
    /// @dev epoch + 1 in which this plot was last counted toward the nutrient
    ///      floor. Prevents double-counting within an epoch.
    uint32 nutrientMarker;
    uint32 drawnThisEpoch; // raw units taken from the well this epoch
    uint16 waterHealth; // 0..HEALTH_MAX, as of lastTendedEpoch
    uint16 nutrientHealth; // 0..HEALTH_MAX, as of lastTendedEpoch
    PlotStatus status;
    OfflineMode offline;
}

struct SeasonState {
    uint32 level; // current level; each completion starts a harder one
    uint32 epoch; // last settled epoch
    uint32 activePlots;
    uint32 tendedLastEpoch;
    uint32 consecutiveHealthyEpochs; // drives level completion
    uint16 lastRequirement; // the x that was rolled for the last settled epoch
    SeasonOutcome outcome;
}

interface IGardenEvents {
    event SeasonStarted(uint32 indexed level, uint256 genesis, uint32 plots);
    event PlotClaimed(uint256 indexed plotId, address indexed owner);
    event PlotCeded(uint256 indexed plotId, address indexed from, address indexed to);
    event PlotAdopted(uint256 indexed plotId, address indexed steward);
    event PlotReverted(uint256 indexed plotId);

    /// @dev The single most important event in the game. Indexed by The Graph
    ///      into the public draw ledger -- and note it carries `forborne`,
    ///      the draw a player was entitled to and chose not to take. That is
    ///      the headline number in the UI, not `amount`.
    event WaterDrawn(
        uint256 indexed plotId, address indexed by, uint32 indexed epoch, uint32 amount, uint32 forborne
    );

    event NutrientsBought(uint256 indexed plotId, uint32 indexed epoch, uint32 amount);
    event SeedsContributed(uint256 indexed plotId, uint32 indexed epoch, uint32 amount);
    event ResourceShared(uint256 indexed from, uint256 indexed to, uint32 offered, uint32 given);
    event OfflineModeSet(uint256 indexed plotId, OfflineMode mode);

    event SettlementRequested(uint32 indexed epoch, uint256 requestId);
    event EpochSettled(
        uint32 indexed epoch, uint16 requirement, uint32 wellLevel, uint32 plotsMet, uint32 plotsMissed
    );
    event SeasonEnded(uint32 indexed level, SeasonOutcome outcome, uint32 atEpoch);
}
