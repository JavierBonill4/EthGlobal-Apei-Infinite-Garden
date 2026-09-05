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
