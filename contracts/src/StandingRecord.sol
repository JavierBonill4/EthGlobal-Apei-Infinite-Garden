// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SoulboundERC721} from "./SoulboundERC721.sol";
import {IPlotArt, StandingData} from "./art/IPlotArt.sol";

/// @title StandingRecord
/// @notice One per player. Never transferable, NEVER revoked, but mutable --
///         the art redraws as the record changes.
///
/// A RECORD, NOT A SCORE. There is deliberately no single number here. A score
/// invites leaderboard optimisation, which is the individual-progression trap
/// the design rules out. A multi-dimensional record invites judgement instead,
/// and there is nothing to game because there is no target.
///
/// It must also stay honestly ambiguous. A heavy draw is not evidence of
/// anything on its own -- it may be the reason a tier unlocked. This contract
/// records what happened. It never adjudicates what it meant.
contract StandingRecord is SoulboundERC721 {
    address public immutable garden;
    IPlotArt public art;

    mapping(uint256 => StandingData) public records;
    mapping(address => uint256) public tokenOf;

    event RecordUpdated(uint256 indexed tokenId, address indexed player);
    event ArtChanged(address indexed art);

    error OnlyGarden();
    error AlreadyMinted();

    modifier onlyGarden() {
        if (msg.sender != garden) revert OnlyGarden();
        _;
    }

    constructor(address garden_, address art_) SoulboundERC721("Garden Standing", "STANDING") {
        garden = garden_;
        art = IPlotArt(art_);
    }

    /// @dev The renderer is swappable so art can be replaced without touching
    ///      the record. See art/ART.md.
    ///      TODO(governance): put this behind the community vote, or renounce
    ///      it before mainnet. An owner who can rewrite everyone's art is a
    ///      centralisation smell in a game about centralisation.
    function setArt(address art_) external onlyGarden {
        art = IPlotArt(art_);
        emit ArtChanged(art_);
    }

    function mintFor(address player) external onlyGarden returns (uint256 id) {
        if (tokenOf[player] != 0) revert AlreadyMinted();
        id = _nextId++;
        tokenOf[player] = id;
        _mintLocked(player, id);
    }

    /// @dev Recency must matter more than lifetime totals -- otherwise this is
    ///      the eBay feedback attack: farm a clean history cheaply, then spend
    ///      it on one large betrayal at the moment it hurts most.
    ///      TODO(ui): expose a trailing-window view and a volatility signal.
    function update(address player, StandingData calldata r) external onlyGarden {
        uint256 id = tokenOf[player];
        records[id] = r;
        emit RecordUpdated(id, player);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId); // reverts if not minted
        return art.renderStanding(tokenId, records[tokenId]);
    }

    /// @notice Always true. Never unlocked, never revoked.
    function locked(uint256) public pure override returns (bool) {
        return true;
    }
}
