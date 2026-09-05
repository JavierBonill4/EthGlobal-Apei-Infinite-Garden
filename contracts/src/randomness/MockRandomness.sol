// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessSource, IRandomnessConsumer} from "../interfaces/IRandomnessSource.sol";

/// @title MockRandomness
/// @notice Test/local source. Anyone can fulfil, so tests can steer the roll.
///         NEVER deploy this to a public network.
contract MockRandomness is IRandomnessSource {
    uint256 public nextRequestId = 1;
    mapping(uint256 => address) public requester;

    event Requested(uint256 indexed requestId, address indexed by);
    event Fulfilled(uint256 indexed requestId, uint256 word);

    function requestRandomness() external returns (uint256 requestId) {
        requestId = nextRequestId++;
        requester[requestId] = msg.sender;
        emit Requested(requestId, msg.sender);
    }

    /// @notice Deliver a chosen word. Test-only affordance.
    function fulfil(uint256 requestId, uint256 word) external {
        address to = requester[requestId];
        require(to != address(0), "unknown request");
        delete requester[requestId];
        emit Fulfilled(requestId, word);
        IRandomnessConsumer(to).onRandomness(requestId, word);
    }
}
