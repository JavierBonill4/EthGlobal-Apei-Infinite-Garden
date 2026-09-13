# temp-home-garden/

**Home base.** The view you start in and the one you leave from. Open
`temp-home-garden-preview.html` directly in a browser — no server, no build.

Both other views are somewhere you *go*, so both exits are roads with signposts
standing on them rather than menu items:

| Walk to | Goes to |
|---|---|
| The signpost west, on the lane — *"the woodland"* | `../stroll/stroll-preview.html` |
| The signpost east, on the lane, beside a cairn — *"the garden state"* | `../garden-state/garden-state-preview.html` |

Walk with **WASD** / arrows, press **Space** at a signpost. The links are also
always visible top-right as real `<a>` tags, for the same reason
`garden-state-preview.html` uses them: navigation has to work even if the
script breaks.

### Finding the exits is part of the design, and it took two goes

The first pass had both exits drawn from the same `prop-signpost.svg` and named
only once you were standing on them — so the only way to learn where a road
went was to walk down it, and the second exit may as well not have existed.
Three things fix that, and all three are worth keeping:

- **The signs are painted in the world**, always readable. A signpost that
  doesn't say where it goes is a post.
- **The overlook has a cairn beside it** so the two exits are not the same
  picture. No new art — that is `prop-stone.svg` nudged off the post.
- **Off-screen exits get an edge marker.** Moving the exits inward helps at
  1280px and does nothing at 900px; the window is the variable, so the fix has
  to answer to the window rather than to the map.

## Why "temp"

The art is the existing placeholder tileset in `../../world/` — flat vector
with ink outlines, from before the watercolour direction landed. It does not
match `Stroll.png` or `Garden State.png` and it is not supposed to. **What is
worth keeping when this gets repainted is the camera and the layout, not these
sprites.**

## The camera, which is the part to preserve

An axis-aligned grid under a pitched camera — **not isometric**. The grid is
never rotated, rows run left to right, and a tile is a rectangle.

```
tileW 64 · tileH 40 · tileH/tileW = 0.625
```

That ratio **is** the projection; there is no matrix anywhere. It is baked into
every ground tile in `../../world/`, so changing the numbers in this file does
not change the camera — it just makes the art wrong. Anything that stands up is
a billboard with an **anchor**: the point in its own viewBox that lands on the
tile's ground centre (copied from `../../manifest.json`). A sprite that hovers
or sinks has a wrong anchor, not a wrong drawing.

Depth is **occlusion only** — `z-index` from world *y*, so walking behind a tree
hides you. There is no perspective maths and there shouldn't be.

## Two details that look like bugs and aren't

- **The fence has one gap.** That is the gate, and the fence you can see and the
  edges you cannot walk through are generated from the same rectangle in one
  function — two lists is how a demo ends up walking through a fence.
- **The 5×5 of beds is ONE plot.** It renders a single `Plot` struct's water
  band, not 25 independent values. Everything you do in here resolves to one
  `plotId`.

## Not wired up

Two one-line edits would close the navigation loop, both in files this folder
doesn't own:

- `../garden-state/garden-state-preview.html` — its nav has a disabled
  `→ Third view (soon)`; point it here.
- `../stroll/stroll-preview.html` — has no nav at all; a `← Home garden` link
  would let you get back without the browser button.
