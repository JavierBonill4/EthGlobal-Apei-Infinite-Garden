// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessSource, IRandomnessConsumer} from "../interfaces/IRandomnessSource.sol";

/// @title ChainlinkVRFSource
/// @notice Production randomness. Adapts Chainlink VRF v2.5 to IRandomnessSource.
///
/// WHY NOT block.prevrandao:
///   `settleBegin()` is permissionless by design (anyone can advance the world
///   for a bounty). If the roll were derived from prevrandao, whoever calls
///   settlement could read it first and simply decline to call when the
///   outcome is unfavourable -- silently choosing the world's fate. VRF's
///   request/fulfil split makes the caller commit before the word exists.
///
// TODO(integration): install the Chainlink contracts and swap the stubs below
// for the real base class:
//
//   forge install smartcontractkit/chainlink-brownie-contracts
//
//   import {VRFConsumerBaseV2Plus} from
//     "<at>chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
//   import {VRFV2PlusClient} from
//     "<at>chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
//
// (write the remapping prefix as a literal @ in your editor -- it is escaped
// here only so solc does not read it as a NatSpec tag)
//
// Then have this contract extend VRFConsumerBaseV2Plus, call
// s_vrfCoordinator.requestRandomWords(...) in requestRandomness, and forward
// from fulfillRandomWords into _deliver().
contract ChainlinkVRFSource is IRandomnessSource {
    address public immutable consumer;
    address public immutable coordinator;
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;

    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant CALLBACK_GAS_LIMIT = 500_000;
    uint32 public constant NUM_WORDS = 1;

    error OnlyConsumer();
    error OnlyCoordinator();
    error NotWired();

    constructor(address _consumer, address _coordinator, bytes32 _keyHash, uint256 _subscriptionId) {
        consumer = _consumer;
        coordinator = _coordinator;
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }

    /// @inheritdoc IRandomnessSource
    function requestRandomness() external view returns (uint256) {
        if (msg.sender != consumer) revert OnlyConsumer();
        // TODO(integration): replace with the real coordinator call.
        revert NotWired();
    }

    /// @dev Shape of the callback once the real base class is wired in.
    function _deliver(uint256 requestId, uint256 word) internal {
        IRandomnessConsumer(consumer).onRandomness(requestId, word);
    }
}
