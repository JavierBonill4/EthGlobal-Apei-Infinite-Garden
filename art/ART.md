# Art handoff

Everything visual in this game lives in this folder or behind one interface.
Nothing here is final — the placeholders are deliberately crude so nobody
mistakes them for a decision. **This document is the brief, not the artwork.**

If you are the designer picking this up: you do not need to read any of the
game code. Read the *States* section, look at `manifest.json`, and replace
files. Everything else is here for the developer.

---

## The one rule

**Same filename in, same filename out.** The app finds art through
`manifest.json`, so a new asset is a drop-in replacement as long as the file
name and the viewBox match. No code changes, no rebuild of the contracts.

There are exactly two swap points in the whole project:

| Where | What it renders | How to replace |
|---|---|---|
| `art/` + `manifest.json` | Everything in the web app | Drop in files, keep names |
| `contracts/src/art/PlaceholderArt.sol` | The NFT images themselves | Deploy a new `IPlotArt`, call `setArt()` |

The second one only matters for the tokens people own. It can be done last,
and it can be done after launch — that is why it is a swappable contract.

---

## What the art has to communicate

This is the part that matters more than style. The game has one job for its
visuals: **a player must be able to tell how the world is doing without
reading a number.** Nobody should have to be told the shared well is at 19%.
They should look at the garden and feel it.

So the assets are not decoration — they are the dashboard. Two consequences:

- **Health has to read at a glance, and from a distance.** A plot in trouble
  and a plot doing fine should be distinguishable in a thumbnail, in
  peripheral vision, in a screenshot on a projector.
- **Creatures leaving is the main signal.** Rare creatures only appear when
  the whole world has been in good condition for a while. When they stop
  coming, everyone knows something is wrong and nobody knows how wrong. That
  ambiguity is intentional — don't design a "danger" state that resolves it.


---

## The camera

The reference is the **DS-era Pokémon overworld**, not an isometric map. If you
only take one thing from this section: **the grid is never rotated.** Rows run
left to right across the screen. Columns run away from you. A tile is a
rectangle, not a diamond.

```
        isometric (the atlas)          this game (the world)
             ◇ ◇ ◇                        ▭ ▭ ▭
            ◇ ◇ ◇ ◇                       ▭ ▭ ▭
             ◇ ◇ ◇                        ▭ ▭ ▭
       grid rotated 45°               grid square, squashed
```

| Constant | Value | What it is |
|---|---|---|
| `tileW` | 64 | One tile, across |
| `tileH` | 40 | The same tile, in depth, after foreshortening |
| `unitHeight` | 40 | Screen pixels per world unit of *height* |
| `pitchDegrees` | 51 | Implied camera pitch: `acos(40/64)` |

`tileH / tileW = 0.625` **is** the camera. There is no projection matrix
anywhere — every ground asset is drawn already squashed, at 64×40, and the
engine just places it. That is the deal that keeps the art authorable: you draw
what you will see.

**Change `tileW` or `tileH` and every ground tile in this folder is wrong.**
They are in `manifest.json` so the engine and the art agree on one number, not
so they can be tuned casually.

### Things that stand up

Anything that is not ground is a **billboard**: drawn upright at full height,
never squashed, and composited over the ground plane. A fence is as tall on
screen as it would be if you were standing there. This is the entire reason the
world reads as a place rather than a floor — squash a tree by 0.625 and you get
a rug with a tree printed on it.

Each standing asset declares an **anchor** in `manifest.json`: the point in its
own viewBox that lands on the tile's ground centre. Feet, base of post, bottom
of trough. Get the anchor wrong and the object hovers or sinks; nothing else
about the asset matters as much.

Draw order is painter's: sort by world *y*, back to front, so a player walking
behind a tree is occluded by it. That occlusion is worth protecting — it is
most of what sells the depth.

### Two decisions worth arguing with

**Why not just use the isometric atlas projection?** Because they are for
different jobs and the project needs both. A map is *read*, from above; a place
is *stood in*. The atlas zooms from the whole coastline down to a sector because
nested commons only feel true if you can see the nesting. But keep zooming in on
an isometric grid and your own patch stays a cell in a spreadsheet — you never
arrive anywhere. The switch from atlas to world is where the game stops being
something you administer and starts being somewhere you are, and that deserves a
different camera, not more zoom.

**Why affine and not true perspective?** Real perspective means a vanishing
point, which means tile picking, collision and hit-testing all stop being
division and start being ray casts — for a difference nobody perceives across a
twelve-tile view. The DS games are largely doing the same trick. Depth cues come
from the near/far post sizes baked into `prop-fence-v.svg` and from occlusion,
not from the maths.

---

## Overworld tileset — `art/world/`

Registered under `"world"` in `manifest.json`. Ground tiles are plain file
paths; everything that stands up carries `anchor` and `size`.

### Ground — 64×40, all four edges must tile

| File | Notes |
|---|---|
| `tile-grass.svg` | The default. Mow bands give the ground a direction |
| `tile-grass-worn.svg` | Variation. Scatter at ~1 in 4 or the field reads as wallpaper |
| `tile-path.svg` | The lane. One tile per sector is path, not plot — matches the contract's verge |
| `tile-soil.svg` | Bare workable ground inside a fence |
| `tile-water.svg` | Impassable |

### Beds — 64×70, anchor `[32,45]`

One per health band, plus wilderness. **These are the dashboard.** A player
should read the state of a plot across the garden without stopping, so the
difference between bands is plant count, height, droop and colour all at once —
not a tint. `bed-wilderness.svg` is not a fifth severity: it is nobody's plot,
and per the rule above it reads *peaceful*.

### Props

| File | Anchor | Notes |
|---|---|---|
| `prop-well.svg` | `[36,78]` | The commons. Its `.well-water` ellipse is a separate element so the app can drop the level |
| `prop-trough.svg` | `[22,24]` | Per-plot. Fills as you water |
| `prop-fence-h.svg` | `[32,22]` | East–west run |
| `prop-fence-v.svg` | `[11,42]` | North–south run. Near post larger than far — that difference *is* the camera |
| `prop-fence-post.svg` | `[8,22]` | Corners |
| `prop-tree.svg` | `[38,92]` | Tall enough to occlude a player |
| `prop-signpost.svg` | `[17,48]` | |
| `prop-stone.svg` | `[17,20]` | |
| `portal.svg` | `[34,86]` | The only violet in the palette — see below |

### Avatar — 34×54, anchor `[17,50]`

`avatar-s / n / e / w`. One frame per facing; the app bobs the sprite instead of
animating a walk cycle, which reads as walking and costs no art. Two-frame walk
cycles are the obvious next thing to draw.

### The portal is deliberately ugly here

Every other colour in the overworld palette belongs to something that grows.
The portal is violet, and it is meant not to sit comfortably beside the beds —
it is a hole in the world, and a player should feel slightly wrong walking into
one. If a later pass makes portals blend in, that is a regression, not a polish.

---

## Daylight is not a theme

The UI chrome follows the browser's light/dark setting. **The world does not.**
Switch to dark and the panels around the garden go dark while the garden stays
in daylight.

That is a position, not an oversight: night should be something that happens
*in* the world — an epoch, a season, a collapse — not something that happens to
the browser. A world that dims because someone changed an OS preference has told
the player a lie about the game state.

Mechanically this falls out of how the assets are written: every colour is
`var(--ig-w-name, #LITERAL)`. Loaded through `<img>` the custom property is out
of scope and the literal wins, which is exactly what makes files drop-in
replaceable. Inline the same SVG and the tokens take over. Both paths are
supported; the app uses `<img>`.

---

## States

Every plot has two independent health values, `water` and `nutrient`, each
`0–1000`. They are banded for display. **These thresholds are mirrored in
`PlaceholderArt.sol` and in `manifest.json` — if you change one, change all
three or the on-chain art and the app will disagree.**

| Band | Range | Reads as | Feeling |
|---|---|---|---|
| `thriving` | 700–1000 | Lush, full, animals present | Earned, not permanent |
| `steady` | 400–699 | Fine. Ordinary. | Neutral — most of the game lives here |
| `stressed` | 150–399 | Dry, thinning, colour draining | Worrying but recoverable |
| `dying` | 0–149 | Bare soil, cracked, empty | Grim, not gory |

Two more states apply to the whole world rather than one plot:

| State | When | Note |
|---|---|---|
| `scarred` | Minted during a season that collapsed | Marks the **era**, not the player. Every plot from that season carries it. Should read as history, not shame. |
| `healed` | A scarred token that survived to a later completion | Should look **better** than never-scarred. Carrying a healed scar means someone stayed through a collapse. |

That last row is a real design point, not a flourish: a healed scar is the
rarest thing in the game, so it should be the most beautiful.

---

## Asset list

Sizes are viewBox dimensions. SVG throughout — plots are rendered at many
sizes and the whole map zooms.

### Backgrounds — `art/backgrounds/`

| File | viewBox | Notes |
|---|---|---|
| `plot-thriving.svg` | 160×160 | |
| `plot-steady.svg` | 160×160 | |
| `plot-stressed.svg` | 160×160 | |
| `plot-dying.svg` | 160×160 | |
| `plot-wilderness.svg` | 160×160 | Reverted, unowned. Should look *peaceful*, not ruined — an abandoned garden becomes a field, not a wreck. |
| `world-backdrop.svg` | 1600×900 | Sits behind the whole map. Very low contrast. |

Plots tile edge to edge, so **the four edges of each 160×160 must be
interchangeable** — a thriving plot will sit next to a dying one constantly.

### Creatures — `art/creatures/`

Creatures are attracted, never taken. They sit on top of a plot background at
roughly 40% of its size, anchored bottom-centre.

| Class | Files | Appears when |
|---|---|---|
| Common | `bee.svg`, `butterfly.svg`, `rabbit.svg` | Local conditions only — your own plot |
| Uncommon | `heron.svg`, `fox.svg`, `glowmoth.svg` | Neighbours' conditions too |
| Rare | `crane.svg`, `white-stag.svg` | The whole world, sustained over many epochs |
| Mythical | `turtle-duck.svg`, `moss-lion.svg`, `lantern-fox.svg` | World + neighbourhood + one specific local planting |

**The mythicals are the payoff for collective restraint** and the source of
the rarest collectibles. They should feel like a genuine event when one shows
up. Nobody can farm them.

Design freedom here is wide — "turtle-duck" is a placeholder name from a
brainstorm, not a spec. Invented hybrids are encouraged as long as they read
clearly at small size.

### UI — `art/ui/`

| File | viewBox | Notes |
|---|---|---|
| `well-gauge.svg` | 240×80 | The shared well. Falls visibly. |
| `band-meter.svg` | 320×64 | Shows the safe band and where the world currently sits. Both edges of the band are **unknown to players** — the art must show uncertainty, not a crisp line. |
| `epoch-clock.svg` | 64×64 | Time to next settlement |

`band-meter.svg` is the hardest and most important asset in the list. See
`docs/DESIGN.md` §02 for what it has to express.

---

## Palette

`tokens.css` holds every colour as a CSS custom property, in light and dark.
**Use the tokens, not literals** — the app is theme-aware and a hard-coded
colour will look wrong in one of the two themes.

The current palette is a placeholder too: a cool lichen/verdigris set chosen
to avoid the warm-terracotta look every garden project defaults to. Change it
freely — just change it in `tokens.css` and everything follows.

Semantic colours (`--sev-*`) are separate from the accent on purpose. Do not
use the accent to mean "danger".

---

## Constraints from the platform

- **SVG only** for plots and creatures. They scale, they theme, and they stay
  small enough to inline.
- **No external fonts inside SVG assets.** Convert text to paths, or leave
  text to the app.
- **Keep each plot asset under ~8KB.** Hundreds render at once.
- **On-chain art has a harder budget still** — it is stored in contract
  bytecode and rendered by `PlaceholderArt.sol`. Assume a few hundred bytes of
  path data, not a few thousand. Simple geometry, flat fills, no gradients.
  The app art and the on-chain art are allowed to differ in fidelity; they
  must not differ in *meaning*.
- **Respect `prefers-reduced-motion`** for anything animated.

---

## Adding an asset

1. Drop the SVG into the right folder.
2. Add an entry to `manifest.json`.
3. Nothing else.

The app reads `manifest.json` at build time through
`web/components/art/ArtLayer.tsx`. That component is the only file in the
frontend that knows where art lives — if you find yourself importing an SVG
anywhere else, that is a bug.
