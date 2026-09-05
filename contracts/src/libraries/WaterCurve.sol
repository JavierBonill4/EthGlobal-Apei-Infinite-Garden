// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WaterCurve
/// @notice Diminishing returns on an individual water draw.
///
/// The whole tension of the well lives in one asymmetry:
///
///   - The PLOT is credited on a curve that flattens to zero marginal benefit.
///   - The WELL is debited the FULL amount drawn, always.
///
/// So past `HARD_CAP` a player is burning the commons for literally nothing.
/// This makes calculated greed self-limiting, which is deliberate: the
/// genuinely destructive behaviour in this game is *panic* drawing under an
/// unknown requirement, not a rational actor optimising. Panic is the villain.
library WaterCurve {
    /// @dev Full credit for every unit up to here.
    uint32 internal constant SOFT_CAP = 100;

    /// @dev Half credit from SOFT_CAP to here. Zero credit beyond.
    uint32 internal constant HARD_CAP = 250;

    /// @notice Health credited to a plot for drawing `amount` units this epoch.
    /// @param amount Raw units drawn from the well.
    /// @return credited Units of water health actually gained.
    function effective(uint32 amount) internal pure returns (uint32 credited) {
        if (amount <= SOFT_CAP) return amount;
        if (amount <= HARD_CAP) return SOFT_CAP + ((amount - SOFT_CAP) / 2);
        return SOFT_CAP + ((HARD_CAP - SOFT_CAP) / 2);
    }

    /// @notice The largest draw that still does anything at all.
    function pointOfNoBenefit() internal pure returns (uint32) {
        return HARD_CAP;
    }
}
