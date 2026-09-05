// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-5192 minimal soulbound interface.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @title SoulboundERC721
/// @notice A deliberately hand-rolled, minimal ERC-721.
///
/// Why not OpenZeppelin: in a soulbound token roughly ninety percent of the
/// ERC-721 machinery exists only to revert. Approvals, operators and safe
/// transfer callbacks are all dead weight here, and inheriting them invites
/// somebody to "fix" a revert later. This is small enough to audit by reading.
///
/// ERC-5192 standardises `locked()` and requires transfers to revert while
/// locked. It says nothing about UNlocking -- so the completion unlock in
/// Collectibles is our own logic, and legitimately so.
abstract contract SoulboundERC721 is IERC5192 {
    string public name;
    string public symbol;

    uint256 internal _nextId = 1;

    mapping(uint256 => address) internal _ownerOf;
    mapping(address => uint256) internal _balanceOf;
    mapping(uint256 => bool) internal _locked;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error Soulbound();
    error NotMinted(uint256 tokenId);
    error ZeroAddress();

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    // --- views ---

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NotMinted(tokenId);
    }

    function balanceOf(address owner) public view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balanceOf[owner];
    }

    function locked(uint256 tokenId) public view virtual returns (bool) {
        if (_ownerOf[tokenId] == address(0)) revert NotMinted(tokenId);
        return _locked[tokenId];
    }

    function tokenURI(uint256 tokenId) public view virtual returns (string memory);

    function supportsInterface(bytes4 interfaceId) public pure virtual returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f // ERC-721Metadata
            || interfaceId == 0xb45a3c0e; // ERC-5192
    }

    // --- transfers: all of them refuse while locked ---

    function transferFrom(address, address, uint256 tokenId) external view {
        if (_locked[tokenId]) revert Soulbound();
        revert Soulbound(); // TODO(unlock): permit transfer once unlocked.
    }

    function safeTransferFrom(address, address, uint256 tokenId) external view {
        if (_locked[tokenId]) revert Soulbound();
        revert Soulbound();
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    // --- internals ---

    function _mintLocked(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        _ownerOf[tokenId] = to;
        _balanceOf[to] += 1;
        _locked[tokenId] = true;
        emit Transfer(address(0), to, tokenId);
        emit Locked(tokenId);
    }

    function _unlock(uint256 tokenId) internal {
        _locked[tokenId] = false;
        emit Unlocked(tokenId);
    }
}
