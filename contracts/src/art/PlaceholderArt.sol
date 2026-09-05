// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPlotArt, StandingData, PlotVisual} from "./IPlotArt.sol";

/// @title PlaceholderArt
/// @notice DELIBERATELY CRUDE. This exists to prove the interface, not to look
///         good. Flat rectangles and a text label, nothing more.
///
/// REPLACING THIS IS THE WHOLE POINT. Write a new contract implementing
/// IPlotArt, deploy it, and call setArt() on StandingRecord / Collectibles.
/// No game logic changes. See art/ART.md for the asset manifest and the
/// palette tokens the real renderer should use.
///
/// Note the health-band thresholds below are the same ones the offchain
/// renderer in web/components/art uses -- keep them in sync, or a plot will
/// look thriving onchain and dying in the app.
contract PlaceholderArt is IPlotArt {
    // Health bands. Mirror of art/manifest.json -> states.
    uint16 internal constant BAND_THRIVING = 700;
    uint16 internal constant BAND_STEADY = 400;
    uint16 internal constant BAND_STRESSED = 150;

    function renderStanding(uint256 tokenId, StandingData calldata d) external pure returns (string memory) {
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">',
            '<rect width="320" height="320" fill="#E8ECE7"/>',
            '<text x="20" y="40" font-family="monospace" font-size="14" fill="#14201B">STANDING #',
            _u(tokenId),
            "</text>",
            '<text x="20" y="80" font-family="monospace" font-size="12" fill="#5A675F">left ',
            _u(d.waterForborne),
            " / taken ",
            _u(d.waterTaken),
            "</text>",
            '<text x="20" y="104" font-family="monospace" font-size="12" fill="#5A675F">seeds given ',
            _u(d.seedsGiven),
            "</text>",
            '<text x="20" y="128" font-family="monospace" font-size="12" fill="#5A675F">epochs ',
            _u(d.epochsPresent),
            "</text>",
            '<text x="20" y="152" font-family="monospace" font-size="12" fill="#5A675F">collapses ',
            _u(d.collapsesPresentFor),
            "</text>",
            '<text x="20" y="300" font-family="monospace" font-size="10" fill="#8C2F3D">PLACEHOLDER ART</text>',
            "</svg>"
        );
        return _json("Standing Record", "A record of how one player acted. Not a score.", svg);
    }

    function renderCollectible(uint256 tokenId, PlotVisual calldata v) external pure returns (string memory) {
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">',
            '<rect width="320" height="320" fill="',
            _band(v.waterHealth),
            '"/>',
            '<circle cx="160" cy="150" r="',
            _u(uint256(40 + (v.nutrientHealth / 20))),
            '" fill="#12756A" opacity="0.5"/>',
            '<text x="20" y="40" font-family="monospace" font-size="14" fill="#14201B">GROWN #',
            _u(tokenId),
            "</text>",
            v.scarred && !v.healed
                ? '<text x="20" y="280" font-family="monospace" font-size="11" fill="#8C2F3D">SCARRED</text>'
                : "",
            v.healed ? '<text x="20" y="280" font-family="monospace" font-size="11" fill="#12756A">HEALED</text>' : "",
            '<text x="20" y="300" font-family="monospace" font-size="10" fill="#8C2F3D">PLACEHOLDER ART</text>',
            "</svg>"
        );
        return _json("Grown", "Something a player grew. It does not say how.", svg);
    }

    // --- helpers ---

    function _band(uint16 health) internal pure returns (string memory) {
        if (health >= BAND_THRIVING) return "#CFE3D4";
        if (health >= BAND_STEADY) return "#E8ECE7";
        if (health >= BAND_STRESSED) return "#EDE4D2";
        return "#E5D2D2";
    }

    /// @dev Plain utf8 data URIs, no base64 dependency. Fine for a placeholder;
    ///      a production renderer should base64-encode so quotes in metadata
    ///      cannot break parsers.
    function _json(string memory name_, string memory desc, string memory svg)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            "data:application/json;utf8,{",
            '"name":"',
            name_,
            '",',
            '"description":"',
            desc,
            '",',
            '"image":"data:image/svg+xml;utf8,',
            svg,
            '"}'
        );
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory b = new bytes(len);
        while (v != 0) {
            b[--len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(b);
    }
}
