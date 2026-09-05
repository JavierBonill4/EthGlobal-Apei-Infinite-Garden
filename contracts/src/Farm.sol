// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Farm
/// @notice The communal nutrient farm. Players buy nutrients from it and feed
///         it with seeds won from challenges.
///
///         The important property, straight from the architecture doc: "adding
///         plants to the farm is useless if there's not enough work behind it."
///         Contributions below COORDINATION_THRESHOLD in an epoch produce
///         NOTHING. That makes this a coordination game, not a public-goods
///         game -- contributing is only rational if you believe others will
///         contribute too, which is the thing that forces players to talk to
///         each other. Do not soften this into a linear payout.
library Farm {
    struct State {
        uint32 stock; // nutrients available to buy right now
        uint32 seedsThisEpoch; // reset every settlement
        uint32 labourThisEpoch; // from OfflineMode.WorkFarm players
        uint32 baseProduction;
    }

    /// @dev Seeds below this in a single epoch are wasted entirely.
    uint32 internal constant COORDINATION_THRESHOLD = 40;

    /// @dev Seeds convert at this rate once the threshold is cleared.
    uint32 internal constant SEED_YIELD = 3;

    /// @dev Each logged-off farm worker adds this much, capped by seeds present.
    uint32 internal constant LABOUR_YIELD = 2;

    error OutOfStock(uint32 requested, uint32 available);

    function init(State storage s, uint32 baseProduction_) internal {
        s.baseProduction = baseProduction_;
        s.stock = baseProduction_;
    }

    function contributeSeeds(State storage s, uint32 amount) internal {
        s.seedsThisEpoch += amount;
    }

    function addLabour(State storage s, uint32 workers) internal {
        s.labourThisEpoch += workers;
    }

    function buy(State storage s, uint32 amount) internal {
        if (amount > s.stock) revert OutOfStock(amount, s.stock);
        unchecked {
            s.stock -= amount;
        }
    }

    /// @notice Called once per settlement. Returns what was produced so the
    ///         caller can emit it.
    function produce(State storage s) internal returns (uint32 produced) {
        produced = s.baseProduction;

        if (s.seedsThisEpoch >= COORDINATION_THRESHOLD) {
            produced += s.seedsThisEpoch * SEED_YIELD;

            // Labour only multiplies work that already exists. Farm workers
            // with no seeds to tend achieve nothing, on purpose.
            uint32 labourCap = s.seedsThisEpoch;
            uint32 labour = s.labourThisEpoch * LABOUR_YIELD;
            produced += labour > labourCap ? labourCap : labour;
        }

        s.stock += produced;
        s.seedsThisEpoch = 0;
        s.labourThisEpoch = 0;
    }
}
