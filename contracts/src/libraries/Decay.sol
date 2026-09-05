// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Decay
/// @notice Lazy decay. A plot's health is never written down every epoch --
///         it is derived on read from `lastTendedEpoch`. An idle plot costs
///         the chain nothing until somebody touches it.
library Decay {
    /// @dev Health lost per untended epoch with no standing instruction.
    uint16 internal constant NORMAL = 120;

    /// @dev Health lost per untended epoch while a "work your plot"
    ///      instruction is still in its grace window.
    uint16 internal constant SLOW = 45;

    /// @dev How many epochs a logged-off instruction holds before normal
    ///      decay resumes. Logging off well-prepared buys you a week, not
    ///      immortality -- otherwise abandonment stops being a failure mode.
    uint32 internal constant GRACE_EPOCHS = 7;

    /// @notice Health remaining after `elapsed` untended epochs.
    /// @param health        Health at `lastTendedEpoch`.
    /// @param elapsed       Epochs since the plot was last tended.
    /// @param plotInstruction True if the owner left a "work your plot" instruction.
    function apply_(uint16 health, uint32 elapsed, bool plotInstruction)
        internal
        pure
        returns (uint16)
    {
        if (elapsed == 0) return health;

        uint32 slowEpochs = 0;
        if (plotInstruction) {
            slowEpochs = elapsed < GRACE_EPOCHS ? elapsed : GRACE_EPOCHS;
        }
        uint32 normalEpochs = elapsed - slowEpochs;

        uint256 loss = (uint256(slowEpochs) * SLOW) + (uint256(normalEpochs) * NORMAL);
        if (loss >= health) return 0;
        return uint16(health - loss);
    }
}
