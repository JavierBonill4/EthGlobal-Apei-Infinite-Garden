// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRandomnessSource
/// @notice The game depends on this, never on Chainlink directly. Two reasons:
///         tests need a deterministic source, and the randomness provider is a
///         swappable detail while the *timing* of the reveal is not.
///
/// @dev TIMING IS THE MECHANIC. The per-epoch water requirement must be rolled
///      AFTER draws for that epoch are locked. If players can see the
///      requirement while they still have a turn, there is no dilemma left --
///      they just draw exactly enough. Settlement is therefore two-phase:
///      `settleBegin()` requests, the callback finalises.
interface IRandomnessSource {
    /// @notice Request one random word. Returns a request id.
    function requestRandomness() external returns (uint256 requestId);
}

/// @notice Implemented by the consumer (the Garden) to receive the word.
interface IRandomnessConsumer {
    function onRandomness(uint256 requestId, uint256 randomWord) external;
}
