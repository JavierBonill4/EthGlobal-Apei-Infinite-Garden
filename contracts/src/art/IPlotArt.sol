// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A player's cumulative record. Deliberately several numbers rather
///         than one score -- see StandingRecord for why.
struct StandingData {
    uint32 waterTaken;
    uint32 waterForborne;
    uint32 seedsGiven;
    uint32 epochsPresent;
    uint32 plotsTendedNotYours;
    uint32 collapsesPresentFor;
    uint32 defencesJoined;
    uint32 votingPowerBurned;
    uint32 lastActiveEpoch;
}

/// @notice Visual state of a plot, handed to the renderer.
struct PlotVisual {
    uint16 waterHealth;
    uint16 nutrientHealth;
    uint8 creatureId; // 0 = none
    bool scarred; // minted during a season that collapsed
    bool healed; // scarred, then survived to a completion
}

/// @title IPlotArt
/// @notice THE ART SWAP POINT.
///
/// Everything visual lives behind this interface so the renderer can be
/// replaced without touching game logic. The placeholder implementation is
/// crude on purpose -- it exists to define the contract, not to look good.
///
/// See art/ART.md for the full asset manifest and the handoff spec.
interface IPlotArt {
    /// @notice Full data URI for a standing record token.
    function renderStanding(uint256 tokenId, StandingData calldata data) external view returns (string memory);

    /// @notice Full data URI for a collectible.
    function renderCollectible(uint256 tokenId, PlotVisual calldata visual) external view returns (string memory);
}
