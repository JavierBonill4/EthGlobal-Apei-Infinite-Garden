#!/usr/bin/env python3
"""
Generates every asset in art/world/ in the watercolour register.

    python3 art/tools/build_world.py

Palette sampled directly out of art/backgrounds/Stroll.png, so the tileset and
the painted Adventure backdrop are the same picture. Colours are written as
`var(--ig-w-name, #LITERAL)`: through <img> the literal wins (which is what
makes a file drop-in replaceable), inlined the token wins.

NO OUTLINES ANYWHERE. Stroll has none, and an ink line is the one thing that
instantly reads as vector. Stems are strokes because a stem IS a line; nothing
else is.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from watercolour import Rng, blob, wash, grain_def, soft_def, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "world")

# --- palette, sampled from Stroll.png -------------------------------------
def c(name, lit):
    return f"var(--ig-w-{name},{lit})"

GRASS   = c("grass",   "#C9DD97")
GRASS2  = c("grass-2", "#BCD57D")
SHADE   = c("shade",   "#688958")
LEAF    = c("leaf",    "#97CC6E")
LEAF2   = c("leaf-2",  "#7DB66C")
LEAF3   = c("leaf-3",  "#61854B")
WOOD    = c("wood",    "#794E45")
WOOD2   = c("wood-2",  "#5B3D2B")
WOOD3   = c("wood-3",  "#411F14")
SOIL    = c("soil",    "#D9C49A")
SOIL2   = c("soil-2",  "#BFA477")
PATH    = c("path",    "#E2D8B4")
PATH2   = c("path-2",  "#CFC196")
WATER   = c("water",   "#A8D3DC")
WATER2  = c("water-2", "#7FB4C4")
STONE   = c("stone",   "#C6C9BC")
STONE2  = c("stone-2", "#A3A899")
PORTAL  = c("portal",  "#9B87C4")
PORTAL2 = c("portal-2","#C6B6E2")
CLOTH   = c("cloth",   "#5E8FA6")
CLOTH2  = c("cloth-2", "#3F6B80")
SKIN    = c("skin",    "#E8CDAE")
HAIR    = c("hair",    "#4A3A30")
CROP = {
    "thriving": c("crop-thriving", "#7DB66C"),
    "steady":   c("crop-steady",   "#A3C47A"),
    "stressed": c("crop-stressed", "#D2BE6A"),
    "dying":    c("crop-dying",    "#B99A63"),
}

TILE_W, TILE_H = 64, 40
DEFS = grain_def("grain", 0.85, 0.2, 5) + soft_def("soft", 0.6)


def write(name, body):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(body)


def grained(inner, soft=True):
    """Artwork, then the same artwork again as pure paper grain masked by its
    own silhouette. One filter per file, applied to a <use> -- so grain follows
    the shape instead of showing up as a faint rectangle around it."""
    f = ' filter="url(#soft)"' if soft else ""
    return (f'  <g id="a"{f}>\n{inner}  </g>\n'
            f'  <use href="#a" filter="url(#grain)"/>\n')


# ==========================================================================
# GROUND
# ==========================================================================
GROUND_NOTE = """GROUND TILE. 64x40 is one world tile already foreshortened by the
       camera (see ART.md "The camera"). Draw squashed; the engine does not
       transform these.
       TILEABLE, and that is why the pools are clipped instead of filtered: a
       feDisplacementMap moves pixels across the tile edge and the seam shows.
       A jittered PATH clipped to the rect tiles perfectly."""


def ground(name, label, base, mid, dark, seed, extra=""):
    rng = Rng(seed)
    body = f'  <clipPath id="c"><rect width="{TILE_W}" height="{TILE_H}"/></clipPath>\n'
    # The base rect is CRISP and full-bleed. Do not blur it and do not inset
    # it: a blurred or inset base fades at the tile edge, and 200 of those
    # fading edges is a visible grid over the whole field. Learned the hard way.
    inner = f'    <rect width="{TILE_W}" height="{TILE_H}" fill="{base}"/>\n'
    inner += '    <g clip-path="url(#c)" filter="url(#soft)">\n'
    for k in range(6):
        cx, cy = rng.range(-4, TILE_W + 4), rng.range(-3, TILE_H + 3)
        rx, ry = rng.range(11, 24), rng.range(7, 14)
        col = mid if k % 2 == 0 else dark
        inner += (f'      <path d="{blob(cx, cy, rx, ry, seed * 13 + k, 9, 0.32)}" '
                  f'fill="{col}" fill-opacity="{rng.range(0.2, 0.38):.2f}"/>\n')
    inner += extra + "    </g>\n"
    return svg(TILE_W, TILE_H, body + grained(inner, soft=False), DEFS, label, GROUND_NOTE)


write("tile-grass.svg", ground("grass", "Meadow ground", GRASS, GRASS2, SHADE, 11))
write("tile-grass-worn.svg", ground(
    "worn", "Worn meadow ground", GRASS, PATH2, SHADE, 29,
    extra=f'      <path d="{blob(30, 22, 17, 9, 77, 9, 0.34)}" fill="{PATH}" fill-opacity=".4"/>\n'))
write("tile-path.svg", ground("path", "Lane", PATH, PATH2, SOIL2, 41))
write("tile-soil.svg", ground(
    "soil", "Tilled soil", SOIL, SOIL2, WOOD2, 53,
    extra="".join(
        f'      <path d="M{2} {y} q16 {-1.5} 30 0 q14 1.5 32 0" fill="none" '
        f'stroke="{SOIL2}" stroke-width="2.4" stroke-opacity=".45" stroke-linecap="round"/>\n'
        for y in (10, 20, 30))))
write("tile-water.svg", ground(
    "water", "Water", WATER, WATER2, WATER2, 67,
    extra="".join(
        f'      <path d="M{x} {y} q5 -2 10 0" fill="none" stroke="#FFFFFF" '
        f'stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>\n'
        for x, y in ((9, 13), (36, 9), (20, 27), (45, 31)))))

# ==========================================================================
# BEDS -- the planting only, over tile-soil
# ==========================================================================
BED_NOTE = """BED. The PLANTING only: this composites over tile-soil.svg, it does not
       replace it. Footprint is exactly one tile (y 8..48); anchor [32,28] lands
       on the tile centre. ONE row per tile -- a 3x3 patch is three rows deep,
       and three rows per tile turned the plot into a hedge with no soil showing.
       No frame: the plot's edge is the fence."""
ROW_Y = 31


def plant(x, y, h, r, col, droop, seed):
    """One clump. Everything is jittered -- height, lean, and where the leaves
    sit -- because the failure mode here is REGULARITY: identical stems with
    identical crossbars, repeated across a tile, stop reading as a row of crops
    and start reading as a picket fence."""
    rng = Rng(seed)
    h = h * rng.range(0.82, 1.18)
    lean = droop + rng.range(-1.6, 1.6)
    tip = x + lean
    o = (f'      <path d="M{x:.1f} {y} Q{x + lean * .35:.1f} {y - h * .6:.1f} '
         f'{tip:.1f} {y - h:.1f}" fill="none" stroke="{col}" stroke-width="2.6" '
         f'stroke-linecap="round" stroke-opacity=".85"/>\n')
    # Leaf mass: overlapping blobs, alternating sides, never paired at the
    # same height.
    for i in range(3):
        t = 0.3 + i * 0.24
        side = 1 if (i + seed) % 2 else -1
        lx = x + lean * t + side * rng.range(3.2, 6.4)
        ly = y - h * t
        rx = rng.range(4.6, 7.2)
        o += (f'      <path d="{blob(lx, ly, rx, rx * rng.range(.5, .72), seed * 7 + i, 8, .32)}" '
              f'fill="{col}" fill-opacity="{rng.range(.6, .82):.2f}"/>\n')
    if r > 0:
        o += (f'      <path d="{blob(tip, y - h - r * .55, r, r * rng.range(.8, 1.0), seed * 3, 9, .24)}" '
              f'fill="{col}" fill-opacity=".92"/>\n')
    return o


BANDS = {
    "thriving": (4, 26, 5.2, 0.0, "lush, full"),
    "steady":   (3, 19, 4.2, 2.0, "ordinary"),
    "stressed": (2, 12, 3.0, 5.0, "thinning, colour draining"),
    "dying":    (2, 6, 0.0, 6.5, "bare, cracked"),
}
for band, (per, hh, rr, droop, note) in BANDS.items():
    col = CROP[band]
    inner = (f'    <path d="{blob(32, ROW_Y + 5, 30, 5.4, 900 + per, 15, 0.3)}" '
             f'fill="{SOIL2}" fill-opacity=".6"/>\n')
    if band == "dying":
        for k, (x, y) in enumerate(((14, 18), (46, 42))):
            inner += (f'      <path d="M{x} {y} q4 5 1 9" fill="none" stroke="{SOIL2}" '
                      f'stroke-width="1.3" stroke-opacity=".7" stroke-linecap="round"/>\n')
    for k in range(per):
        x = 32 + (k - (per - 1) / 2) * (46 / max(per, 1))
        inner += plant(x, ROW_Y, hh, rr, col, droop, 400 + k * 37 + per * 11)
    write(f"bed-{band}.svg",
          svg(64, 48, grained(inner), DEFS, f"Planted row, {band} — {note}", BED_NOTE))

WILD_NOTE = """Reverted to wilderness. Composites over GRASS, not soil: the ground has
       gone back. An abandoned garden becomes a field, not a wreck (ART.md), and
       the missing rows are the whole story -- this is not a fifth severity."""
inner = ""
for i, (x, y) in enumerate(((9, 40), (18, 28), (26, 43), (36, 22), (43, 36),
                            (52, 30), (58, 42), (13, 18), (32, 33), (47, 19))):
    h = 12 + (i % 3) * 5
    inner += (f'    <path d="M{x} {y} q2 {-h * .6:.1f} 4 {-h}" fill="none" stroke="{LEAF3}" '
              f'stroke-width="2.1" stroke-opacity=".75" stroke-linecap="round"/>\n')
    inner += (f'    <path d="{blob(x + 2, y - h, 4.2, 2.8, 500 + i, 7, .3)}" '
              f'fill="{LEAF2}" fill-opacity=".7"/>\n')
for i, (x, y) in enumerate(((23, 31), (40, 25), (54, 35))):
    inner += (f'    <path d="{blob(x, y, 2.2, 2.0, 600 + i, 7, .3)}" '
              f'fill="{CROP["stressed"]}" fill-opacity=".8"/>\n')
write("bed-wilderness.svg",
      svg(64, 48, grained(inner), DEFS, "Wilderness — reverted, unowned, peaceful", WILD_NOTE))

# ==========================================================================
# PROPS
# ==========================================================================
def trunk(x, top, bot, w, col, seed):
    """A trunk as a tapered blob, not a rectangle. Stroll's trunks widen at the
    root and none of them is straight."""
    rng = Rng(seed)
    wob = rng.range(-1.2, 1.2)
    return (f'    <path d="M{x - w * .42:.1f} {bot} '
            f'C{x - w * .5 + wob:.1f} {(top + bot) / 2:.1f} {x - w * .36:.1f} {top + 4} {x - w * .3:.1f} {top} '
            f'L{x + w * .3:.1f} {top} '
            f'C{x + w * .36:.1f} {top + 4} {x + w * .5 - wob:.1f} {(top + bot) / 2:.1f} {x + w * .46:.1f} {bot} Z" '
            f'fill="{col}"/>\n')


write("prop-fence-h.svg", svg(64, 26, grained(
    trunk(4, 6, 22, 4.2, WOOD2, 1) + trunk(32, 7, 22, 3.6, WOOD2, 2) + trunk(60, 6, 22, 4.2, WOOD2, 3) +
    f'    <path d="{blob(32, 10, 31, 1.9, 71, 13, .18)}" fill="{WOOD}" fill-opacity=".95"/>\n'
    f'    <path d="{blob(32, 17, 31, 1.6, 73, 13, .18)}" fill="{WOOD}" fill-opacity=".9"/>\n'),
    DEFS, "Fence, running across",
    """A fence run along an east-west edge. Anchor [32,22] is the ground line.
       The fence is the plot boundary you can SEE -- ownership legible with no label."""))

write("prop-fence-v.svg", svg(22, 62, grained(
    trunk(11, 9, 22, 3.0, WOOD2, 4) + trunk(11, 44, 62, 4.4, WOOD2, 5) +
    f'    <path d="{blob(11, 29, 1.7, 19, 75, 11, .14)}" fill="{WOOD}" fill-opacity=".9"/>\n'
    f'    <path d="{blob(11, 36, 1.5, 19, 76, 11, .14)}" fill="{WOOD}" fill-opacity=".85"/>\n'),
    DEFS, "Fence, running away",
    """A north-south run, foreshortened over one tile of depth (40px). The near
       post is larger than the far one: that difference IS the camera."""))

write("prop-fence-post.svg", svg(16, 26, grained(trunk(8, 5, 22, 4.6, WOOD2, 6)),
    DEFS, "Fence corner post", "Anchor [8,22]."))

write("prop-stone.svg", svg(34, 24, grained(
    wash(17, 14, 13, 8, STONE, STONE2, "#FFFFFF", 81, 3, .26, .95)),
    DEFS, "Stone", "Anchor [17,20]."))

write("prop-trough.svg", svg(44, 30, grained(
    f'    <path d="{blob(22, 19, 19, 7, 83, 11, .16)}" fill="{WOOD}"/>\n'
    f'    <path d="{blob(22, 13, 18, 5, 85, 11, .14)}" fill="{WOOD2}" fill-opacity=".8"/>\n'
    + wash(22, 13, 15, 4, WATER, WATER2, "#FFFFFF", 87, 2, .2, .95)),
    DEFS, "Water trough",
    """Where a plot's water goes. The level is readable from across the garden,
       which is the only reason to draw it at all."""))

write("prop-signpost.svg", svg(34, 50, grained(
    trunk(15, 14, 48, 4.0, WOOD2, 7) +
    f'    <path d="{blob(17, 13, 15, 4.4, 89, 11, .14)}" fill="{WOOD}"/>\n'
    f'    <path d="M7 12h13 M7 15h9" fill="none" stroke="{WOOD2}" stroke-width="1.3" '
    f'stroke-opacity=".6" stroke-linecap="round"/>\n'),
    DEFS, "Signpost", "Anchor [17,48]."))

TREE_NOTE = """Standing scenery, and the cheapest depth cue in the world: tall enough
       to occlude a player walking behind it. Anchor [38,92].
       Canopy is three overlapping washes rather than one silhouette -- in
       Stroll every crown is several layers of translucent green and that
       layering is most of what reads as watercolour."""
write("prop-tree.svg", svg(76, 98, grained(
    f'    <path d="{blob(38, 90, 19, 5, 91, 11, .22)}" fill="{SHADE}" fill-opacity=".3"/>\n'
    + trunk(38, 52, 92, 13, WOOD2, 8)
    + f'    <path d="M38 74 Q31 68 27 60" fill="none" stroke="{WOOD2}" stroke-width="3.4" stroke-linecap="round"/>\n'
    + wash(30, 34, 26, 20, LEAF2, LEAF3, LEAF, 93, 3, .22, .92)
    + wash(50, 28, 24, 18, LEAF, LEAF2, "#FFFFFF", 95, 3, .24, .8)
    + wash(40, 46, 27, 14, LEAF2, LEAF3, LEAF, 97, 3, .2, .7)),
    DEFS, "Tree", TREE_NOTE))

WELL_NOTE = """THE WELL. The most important object in the world: it is the commons, and
       it is the thing that empties. It stands in the lane, never on anyone's
       plot, because nobody owns it. Anchor [40,88].
       `.well-water` is a separate element on purpose -- the app drops its cy and
       ry to show the level, and a low well has to read from across the garden
       with no number attached."""
write("prop-well.svg", svg(80, 100, grained(
    f'    <path d="{blob(40, 86, 29, 7, 101, 11, .2)}" fill="{SHADE}" fill-opacity=".3"/>\n'
    f'    <path d="M13 60 L13 76 Q40 90 67 76 L67 60 Z" fill="{STONE2}"/>\n'
    + wash(40, 61, 26, 9, STONE, STONE2, "#FFFFFF", 103, 3, .18, .95)
    + f'    <path d="{blob(40, 62, 20, 6, 105, 11, .12)}" fill="{WOOD3}" fill-opacity=".75"/>\n'
    f'    <path class="well-water" d="{blob(40, 64, 18, 5, 107, 11, .12)}" fill="{WATER2}"/>\n'
    + trunk(20, 28, 64, 5.4, WOOD2, 9) + trunk(60, 28, 64, 5.4, WOOD2, 10)
    + f'    <path d="M40 5 L77 33 Q40 27 3 33 Z" fill="{WOOD}"/>\n'
    f'    <path d="{blob(40, 38, 24, 1.8, 109, 13, .16)}" fill="{WOOD2}" fill-opacity=".9"/>\n'
    f'    <path d="M40 38 L40 47" fill="none" stroke="{WOOD2}" stroke-width="1.2"/>\n'
    f'    <path d="{blob(40, 52, 7, 6, 111, 9, .18)}" fill="{WOOD}"/>\n'),
    DEFS, "The shared well", WELL_NOTE))

PORTAL_NOTE = """A PORTAL, and the only violet in the world. Everything else in this
       palette is something that grows; this is not, and it should NOT sit
       comfortably beside the beds -- it is a hole in the world and walking into
       one should feel slightly wrong. A later pass that makes portals blend in
       is a regression, not a polish. Anchor [34,86].
       `.portal-veil` and `.portal-mote` are animated by the app, so the file
       stays still when opened on its own."""
write("portal.svg", svg(68, 92, grained(
    f'    <path d="{blob(34, 85, 23, 6, 113, 11, .2)}" fill="{PORTAL}" fill-opacity=".25"/>\n'
    f'    <path d="M6 86 L6 40 A28 30 0 0 1 62 40 L62 86 L50 86 L50 40 A16 18 0 0 0 18 40 L18 86 Z" fill="{STONE}"/>\n'
    f'    <path class="portal-veil" d="M18 86 L18 40 A16 18 0 0 1 50 40 L50 86 Z" fill="{PORTAL}" fill-opacity=".85"/>\n'
    + wash(34, 60, 13, 22, PORTAL2, PORTAL, "#FFFFFF", 115, 3, .16, .5)
    + '    <g class="portal-mote" fill="#FFFFFF" fill-opacity=".7">'
    + "".join(f'<path d="{blob(x, y, r, r, 117 + i, 7, .3)}"/>'
              for i, (x, y, r) in enumerate(((28, 58, 1.8), (40, 47, 1.4), (35, 70, 1.6), (26, 41, 1.2))))
    + "</g>\n"),
    DEFS, "Challenge portal", PORTAL_NOTE))

# ==========================================================================
# AVATAR -- four facings
# ==========================================================================
AV_NOTE = """Avatar, facing {face}. Anchor [17,50] = the feet. BILLBOARD: never
       squashed by the camera, so the player stands UP out of the ground plane."""


def avatar(face, label, arms, hair, eyes, can):
    inner = (f'    <path d="{blob(17, 50, 9, 2.8, 201, 9, .22)}" fill="{SHADE}" fill-opacity=".35"/>\n'
             f'    <path d="M11.4 50 Q11 46 12 43 L14.6 43 Q15 46 14.6 50 Z" fill="{CLOTH2}"/>\n'
             f'    <path d="M19.4 50 Q19 46 20 43 L22.6 43 Q23 46 22.6 50 Z" fill="{CLOTH2}"/>\n'
             f'    <path d="M9.4 44 Q8.6 34 9.8 26 Q17 22.4 24.2 26 Q25.4 34 24.6 44 Z" fill="{CLOTH}"/>\n'
             + arms
             + f'    <path d="{blob(17, 18, 8.2, 8.4, 203, 10, .1)}" fill="{SKIN}"/>\n'
             + hair + eyes)
    return svg(34, 54, grained(inner) + can, DEFS,
               f"Gardener facing {label}", AV_NOTE.replace("{face}", label))


def arm(x1, y1, x2, y2):
    return (f'    <path d="M{x1} {y1} Q{(x1 + x2) / 2 + 1} {(y1 + y2) / 2} {x2} {y2}" fill="none" '
            f'stroke="{CLOTH}" stroke-width="3.6" stroke-linecap="round"/>\n')


CAN = (f'  <g id="can">\n'
       f'    <path d="{blob(29, 41, 4.6, 4.0, 205, 9, .18)}" fill="{STONE}"/>\n'
       f'    <path d="M25 40 L21.5 43" fill="none" stroke="{STONE}" stroke-width="2" stroke-linecap="round"/>\n'
       f'  </g>\n  <use href="#can" filter="url(#grain)"/>\n')
CAN_W = (f'  <g id="can">\n'
         f'    <path d="{blob(5, 41, 4.6, 4.0, 205, 9, .18)}" fill="{STONE}"/>\n'
         f'    <path d="M9 40 L12.5 43" fill="none" stroke="{STONE}" stroke-width="2" stroke-linecap="round"/>\n'
         f'  </g>\n  <use href="#can" filter="url(#grain)"/>\n')

EYES = (f'    <path d="{blob(14, 19, 1.3, 1.4, 207, 7, .2)}" fill="{WOOD3}"/>\n'
        f'    <path d="{blob(20, 19, 1.3, 1.4, 209, 7, .2)}" fill="{WOOD3}"/>\n')

write("avatar-s.svg", avatar("s", "the camera (south)", arm(10, 30, 6, 40) + arm(24, 30, 28, 40),
      f'    <path d="{blob(17, 13, 8.4, 5.4, 211, 10, .16)}" fill="{HAIR}"/>\n', EYES, CAN))
write("avatar-n.svg", avatar("n", "away (north)", arm(10, 30, 6, 40) + arm(24, 30, 28, 40),
      f'    <path d="{blob(17, 15, 8.6, 7.6, 213, 10, .14)}" fill="{HAIR}"/>\n', "", CAN))
write("avatar-e.svg", avatar("e", "right (east)", arm(21, 30, 27, 39),
      f'    <path d="{blob(16, 13, 8.4, 5.6, 215, 10, .16)}" fill="{HAIR}"/>\n',
      f'    <path d="{blob(21, 19, 1.3, 1.4, 217, 7, .2)}" fill="{WOOD3}"/>\n', CAN))
write("avatar-w.svg", avatar("w", "left (west)", arm(13, 30, 7, 39),
      f'    <path d="{blob(18, 13, 8.4, 5.6, 219, 10, .16)}" fill="{HAIR}"/>\n',
      f'    <path d="{blob(13, 19, 1.3, 1.4, 221, 7, .2)}" fill="{WOOD3}"/>\n', CAN_W))

print("wrote", len(os.listdir(OUT)), "assets to art/world/")

# ==========================================================================
# ADVENTURE -- parallax layers for the woodland
# ==========================================================================
# Stroll.png is the backdrop and already carries canopy, mid-trunks and the
# clearing floor. What it cannot do is move at a different rate from the
# player, so the depth comes from these: a NEAR trunk layer drawn in FRONT of
# the player at a faster parallax. Walking behind a trunk and being hidden by
# it is most of what sells a woodland.
ADV = os.path.join(OUT, "..", "adventure")
os.makedirs(ADV, exist_ok=True)


def awrite(name, body):
    with open(os.path.join(ADV, name), "w") as f:
        f.write(body)


def tall_trunk(w, h, x, col, seed, wide=26):
    """A full-height trunk. Stroll's foreground trunks leave the frame at both
    ends and none of them is straight or vertical."""
    rng = Rng(seed)
    lean = rng.range(-9, 9)
    bulge = rng.range(3, 9)
    return (f'    <path d="M{x - wide / 2 + lean:.0f} -10 '
            f'C{x - wide / 2 - bulge:.0f} {h * 0.35:.0f} {x - wide / 2 + bulge:.0f} {h * 0.7:.0f} '
            f'{x - wide / 2 - 3:.0f} {h + 10} '
            f'L{x + wide / 2 + 3:.0f} {h + 10} '
            f'C{x + wide / 2 + bulge:.0f} {h * 0.7:.0f} {x + wide / 2 - bulge:.0f} {h * 0.35:.0f} '
            f'{x + wide / 2 + lean:.0f} -10 Z" fill="{col}"/>\n')


# NEAR trunks: drawn over the player, fast parallax. Two variants so the
# repeat is not obvious at a glance.
for idx, (seed, xs) in enumerate(((301, (60, 300, 520)), (311, (140, 380, 610)))):
    inner = "".join(tall_trunk(700, 560, x, WOOD3, seed + i, 30 + i * 6)
                    for i, x in enumerate(xs))
    awrite(f"adv-trunks-near-{idx + 1}.svg", svg(700, 560, grained(inner), DEFS,
        "Foreground trunks",
        """NEAR parallax layer, drawn IN FRONT of the player. Occlusion is the
       depth cue -- there is no perspective maths in the Adventure view either."""))

# MID bushes: behind the player, slower. Anchored to the BOTTOM of their own
# viewBox so the layer can sit on the ground line -- the first pass put them at
# a fixed mid-height and they read as a row of lily pads floating across the
# frame at the wrong depth.
inner = ""
for i, x in enumerate((30, 130, 235, 350, 455, 565, 675, 745)):
    h = 96 + (i % 4) * 34
    # Two overlapping lobes per bush: one ellipse reads as a lily pad however
    # it is coloured, and undergrowth is darker than the canopy above it.
    inner += wash(x - 16, 240 - h * 0.3, 44 + (i % 3) * 10, h * 0.44,
                  LEAF3, "#3F5C38", LEAF2, 321 + i, 3, .34, .95)
    inner += wash(x + 18, 240 - h * 0.22, 38 + (i % 2) * 12, h * 0.36,
                  LEAF2 if i % 2 else LEAF3, LEAF3, LEAF, 361 + i, 3, .34, .9)
awrite("adv-bushes.svg", svg(760, 240, grained(inner), DEFS, "Mid bushes",
    """MID parallax layer, behind the player. Bottom-anchored: this sits ON the
       ground line, and the heights are uneven so it does not read as a band."""))

# A seed cache. Hidden in the undergrowth: the point is that you cannot tell a
# clearing holds one until you walk into it, so this reads as a bush until it
# is close.
awrite("adv-cache.svg", svg(90, 80, grained(
    wash(45, 52, 34, 24, LEAF2, LEAF3, LEAF, 331, 3, .26, .92)
    + "".join(f'    <path d="{blob(30 + i * 14, 40 + (i % 2) * 9, 5.2, 6.6, 341 + i, 8, .22)}" '
              f'fill="{CROP["steady"]}" fill-opacity=".95"/>\n' for i in range(4))),
    DEFS, "Seed cache",
    """A forage spot. Lumpy, repeatable once per epoch, and at small player
       counts the ONLY realistic way a cohort clears Farm.COORDINATION_THRESHOLD
       -- see web/lib/world/economy.ts. That is what makes Adventure content
       rather than decoration."""))

# A hint marker: a carved stone. Hints are found, not given.
awrite("adv-marker.svg", svg(70, 66, grained(
    wash(35, 44, 24, 17, STONE, STONE2, "#FFFFFF", 351, 3, .24, .95)
    + f'    <path d="M24 40 h22 M24 46 h15 M24 52 h19" fill="none" stroke="{WOOD3}" '
      f'stroke-width="2" stroke-opacity=".45" stroke-linecap="round"/>\n'),
    DEFS, "Carved stone",
    "Carries one hint. Oblique on purpose -- they point at the phrase's shape."))

print("wrote adventure layers to art/adventure/")
