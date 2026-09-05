// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Well
/// @notice The shared water commons. One-sided: more for you is less for
///         everyone, and restraint here is always safe for the world.
///
///         What makes it a dilemma rather than a morality lesson is that the
///         per-epoch health REQUIREMENT is unknown while you are drawing (see
///         Garden.settleBegin). Draw too little and your plot may miss the
///         requirement; draw defensively and the well empties for everyone.
///         The failure this produces is precautionary hoarding -- the bank-run
///         shape -- not calculated greed.
library Well {
    struct State {
        uint32 capacity;
        uint32 level;
        uint32 refillPerEpoch;
    }

    error WellEmpty(uint32 requested, uint32 available);

    function init(State storage s, uint32 capacity_, uint32 refill_) internal {
        s.capacity = capacity_;
        s.level = capacity_;
        s.refillPerEpoch = refill_;
    }

    /// @notice Debit the FULL raw amount. The plot's *credit* is curved
    ///         (see WaterCurve) but the commons always pays face value.
    function draw(State storage s, uint32 amount) internal {
        if (amount > s.level) revert WellEmpty(amount, s.level);
        unchecked {
            s.level -= amount;
        }
    }

    function refill(State storage s) internal {
        uint256 next = uint256(s.level) + s.refillPerEpoch;
        s.level = next > s.capacity ? s.capacity : uint32(next);
    }

    /// @notice Fraction of capacity remaining, in basis points. Feeds stress.
    function levelBps(State storage s) internal view returns (uint16) {
        if (s.capacity == 0) return 0;
        return uint16((uint256(s.level) * 10_000) / s.capacity);
    }
}
