// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SoulboundERC721} from "./SoulboundERC721.sol";
import {IPlotArt, PlotVisual} from "./art/IPlotArt.sol";

/// @title Collectibles
/// @notice What you GREW. Not how you played -- that lives in StandingRecord,
///         deliberately as a separate object.
///
/// THE DECOUPLING
/// A magnificent orchid is a magnificent orchid. A patient player and a
/// reckless one can both grow one, at different speeds and carrying different
/// risk, so the token itself is honestly ambiguous about method. Anyone can
/// still reconstruct the full history from chain data -- that is not hideable
/// and pretending otherwise would be a lie -- but the ASSET does not carry the
/// accusation. That is the achievable version of what the design asked for.
///
/// SCARS MARK THE ERA, NOT THE PLAYER
/// When a season collapses, every collectible minted during it is marked. Not
/// as punishment, as provenance: the whole cohort carries the failure it was
/// part of. The next completion heals every scar, and a HEALED scar should be
/// rarer and more valuable than no scar at all -- carrying one means the
/// holder survived a collapse and stayed through to a completion, which is
/// precisely the behaviour nothing else in the game can incentivise.
contract Collectibles is SoulboundERC721 {
    address public immutable garden;
    IPlotArt public art;

    mapping(uint256 => PlotVisual) public visuals;
    mapping(uint256 => uint32) public mintedInSeason;

    /// @dev Seasons that ended in collapse. Everything minted during one is
    ///      scarred until a later completion heals it.
    mapping(uint32 => bool) public seasonCollapsed;
    uint32 public lastHealedSeason;

    event Scarred(uint32 indexed season);
    event Healed(uint32 indexed upToSeason);
    event SeasonUnlocked(uint32 indexed season);

    error OnlyGarden();

    modifier onlyGarden() {
        if (msg.sender != garden) revert OnlyGarden();
        _;
    }

    constructor(address garden_, address art_) SoulboundERC721("Garden Collectibles", "GROWN") {
        garden = garden_;
        art = IPlotArt(art_);
    }

    function setArt(address art_) external onlyGarden {
        art = IPlotArt(art_);
    }

    function mint(address to, uint32 season, PlotVisual calldata v) external onlyGarden returns (uint256 id) {
        id = _nextId++;
        mintedInSeason[id] = season;
        visuals[id] = v;
        _mintLocked(to, id);
    }

    /// @notice Mark a whole season's mints. Collective, never individual.
    function markCollapse(uint32 season) external onlyGarden {
        seasonCollapsed[season] = true;
        emit Scarred(season);
    }

    /// @notice A completion unlocks every collectible AND heals every scar
    ///         from prior collapses. Everyone present benefits, because that
    ///         is what a public good is.
    /// @dev TODO(gas): unlocking is season-scoped rather than per-token so it
    ///      stays O(1). `locked()` below reads through to the season flag.
    mapping(uint32 => bool) public seasonUnlocked;

    function completeSeason(uint32 season) external onlyGarden {
        seasonUnlocked[season] = true;
        lastHealedSeason = season;
        emit SeasonUnlocked(season);
        emit Healed(season);
    }

    /// @dev A token is locked until the season it was minted in is unlocked.
    function locked(uint256 tokenId) public view override returns (bool) {
        ownerOf(tokenId);
        return !seasonUnlocked[mintedInSeason[tokenId]];
    }

    /// @notice Scarred if its season collapsed and no later completion healed it.
    function scarred(uint256 tokenId) public view returns (bool isScarred, bool isHealed) {
        uint32 s = mintedInSeason[tokenId];
        isScarred = seasonCollapsed[s];
        isHealed = isScarred && lastHealedSeason > s;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId);
        PlotVisual memory v = visuals[tokenId];
        (v.scarred, v.healed) = scarred(tokenId);
        return art.renderCollectible(tokenId, v);
    }
}
