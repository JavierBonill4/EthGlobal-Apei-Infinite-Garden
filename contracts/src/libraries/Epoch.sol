// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Epoch
/// @notice Fixed-length epoch arithmetic. The world never simulates per block:
///         all state is "state at epoch N derived from actions during epoch N-1".
library Epoch {
    /// @dev 24 hours. Every mechanic in the game must fit inside one of these.
    uint256 internal constant DURATION = 1 days;

    /// @notice Current epoch index given the season's genesis timestamp.
    function current(uint256 genesis) internal view returns (uint32) {
        if (block.timestamp < genesis) return 0;
        return uint32((block.timestamp - genesis) / DURATION);
    }

    /// @notice Timestamp at which `epoch` begins.
    function startsAt(uint256 genesis, uint32 epoch) internal pure returns (uint256) {
        return genesis + (uint256(epoch) * DURATION);
    }
}
