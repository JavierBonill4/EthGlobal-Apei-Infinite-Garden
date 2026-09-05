// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Garden} from "../src/Garden.sol";
import {StandingRecord} from "../src/StandingRecord.sol";
import {Collectibles} from "../src/Collectibles.sol";
import {PlaceholderArt} from "../src/art/PlaceholderArt.sol";
import {MockRandomness} from "../src/randomness/MockRandomness.sol";
import {ChainlinkVRFSource} from "../src/randomness/ChainlinkVRFSource.sol";

/// @notice Deploys a season.
///
/// usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
///
/// Set USE_MOCK_RANDOMNESS=true for local anvil runs. Never on a public chain:
/// MockRandomness lets anybody choose the roll.
contract Deploy is Script {
    // Season parameters. These are the numbers you will spend the most time
    // arguing about -- see docs/MECHANICS.md for what each one does to the
    // shape of the game.
    uint32 constant WELL_CAPACITY = 10_000;
    uint32 constant WELL_REFILL = 800;
    uint32 constant FARM_BASE = 50;
    uint256 constant KICKOFF_DELAY = 2 days;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        bool useMock = vm.envOr("USE_MOCK_RANDOMNESS", false);

        vm.startBroadcast(pk);

        address rng;
        if (useMock) {
            rng = address(new MockRandomness());
            console2.log("MockRandomness (LOCAL ONLY)", rng);
        } else {
            // ChainlinkVRFSource needs the Garden's address, and the Garden
            // needs the source's -- so deploy the source second, with a
            // placeholder, then set it. TODO(deploy): make `randomness`
            // settable-once on Garden, or use CREATE2 to precompute.
            revert("wire ChainlinkVRFSource: see TODO in ChainlinkVRFSource.sol");
        }

        Garden garden = new Garden(rng, block.timestamp + KICKOFF_DELAY, WELL_CAPACITY, WELL_REFILL, FARM_BASE);
        PlaceholderArt art = new PlaceholderArt();
        StandingRecord standing = new StandingRecord(address(garden), address(art));
        Collectibles collectibles = new Collectibles(address(garden), address(art));

        vm.stopBroadcast();

        console2.log("Garden        ", address(garden));
        console2.log("PlaceholderArt", address(art));
        console2.log("StandingRecord", address(standing));
        console2.log("Collectibles  ", address(collectibles));
        console2.log("kickoff at    ", block.timestamp + KICKOFF_DELAY);
    }
}
