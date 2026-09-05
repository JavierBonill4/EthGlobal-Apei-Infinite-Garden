// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Garden} from "../src/Garden.sol";
import {MockRandomness} from "../src/randomness/MockRandomness.sol";

/// @notice Advance the world by one epoch on a local chain.
///
/// WHY THIS EXISTS
/// Settlement is two-phase on purpose: `settleBegin()` requests a random word
/// and the callback finalises. On a real network Chainlink delivers that
/// callback. Locally, MockRandomness delivers nothing until somebody calls
/// `fulfil()` -- so if you only call `settleBegin()`, the epoch hangs forever
/// with `pendingRequestId` set, every later settlement reverts with
/// SettlementInFlight, and it looks exactly like a broken contract.
///
/// It is not broken. Nobody rolled the dice.
///
/// usage:
///   # epochs are 24h, so move the clock first
///   cast rpc evm_increaseTime 86400 --rpc-url http://127.0.0.1:8545
///   cast rpc evm_mine --rpc-url http://127.0.0.1:8545
///
///   forge script script/LocalSettle.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract LocalSettle is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        Garden garden = Garden(payable(vm.envAddress("GARDEN_ADDRESS")));
        MockRandomness rng = MockRandomness(vm.envAddress("RNG_ADDRESS"));

        vm.startBroadcast(pk);

        garden.settleBegin();

        // MockRandomness hands out ids sequentially, so the one we just
        // created is the last issued.
        uint256 requestId = rng.nextRequestId() - 1;

        // Any word works locally. Vary the seed to see different requirements
        // -- the roll is uniform over {REQ_MIN, +STEP, ... REQ_MAX}.
        uint256 word = uint256(keccak256(abi.encode(block.timestamp, requestId, blockhash(block.number - 1))));
        rng.fulfil(requestId, word);

        vm.stopBroadcast();

        (,,,,, uint16 requirement,) = garden.season();
        (, uint32 wellLevel,) = garden.well();

        console2.log("settled epoch  ", garden.currentEpoch());
        console2.log("requirement was", requirement);
        console2.log("well level     ", wellLevel);
    }
}
