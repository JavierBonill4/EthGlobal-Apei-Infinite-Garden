# Repo map

Where everything is, what owns what, and which file to open when you want to
change a specific thing.

`ARCHITECTURE.md` explains how the *contracts* work. This explains how the
*repo* works.

---

## 01 — Five areas, five jobs

| Folder | Job | Language |
|---|---|---|
| `contracts/` | The rules, on chain. The only thing that is eventually authoritative | Solidity / Foundry |
| `web/` | The game you actually play | Next.js + TypeScript |
| `art/` | Every visual asset, plus standalone previews that need no build step | SVG, PNG, HTML |
| `docs/` | Design intent and open questions. Argument, not description | Markdown |
| `subgraph/` | Indexes chain events into a queryable ledger | GraphQL / AssemblyScript |

Only two of those are wired to each other today: `web/` reads `art/`. **`web/`
does not talk to `contracts/` yet** — the whole game runs client-side. That is
the single most important thing to know before you change anything.

---

## 02 — The three planes, and which way dependencies point

```
   contracts/src/*.sol          the rules, eventually authoritative
           │  (copied by hand, cited by file and line)
           ▼
   web/lib/world/*.ts           THE MODEL — plain data + pure functions
           │  (read by)
           ▼
   web/components/world/*.tsx   THE VIEW — DOM, canvas, input
```

**Dependencies only ever point down.** A view may read the model; the model
must never import a component. If you find yourself wanting `plants.ts` to know
about a `<div>`, the logic is in the wrong file.

The arrow from Solidity to TypeScript is **a hand copy, not a build step**.
`web/lib/world/mechanics.ts` and `economy.ts` restate the Solidity constants
with the file and line they came from. That is deliberate: it keeps the
prototype honest without a codegen pipeline. It also means **a change in
Solidity does not propagate**, so if you touch a constant in a contract, grep
for it in `web/lib/world/`.

---

## 03 — "I want to change X" → open Y

| You want to change | Open |
|---|---|
| How much water is "enough" | `web/lib/world/mechanics.ts` (`REQ_MIN/MAX/STEP`, `rollRequirement`) |
| What a plant does each epoch | `web/lib/world/plants.ts` → `stepPlant()` — the entire ruleset, pure |
| Plant species, rarity, dust, healing | `web/lib/world/plants.ts` → `SPECIES` |
| The farm / coordination threshold | `web/lib/world/economy.ts` |
| What happens at settlement | `web/lib/world/useGarden.ts` → `settle()` |
| The garden's layout, fences, exits | `web/lib/world/map.ts` |
| Camera, tile size, sprite anchors | `web/lib/world/camera.ts` + `art/manifest.json` |
| How the garden is drawn / walked | `web/components/world/Overworld.tsx` |
| The side panel | `web/components/world/Hud.tsx` |
| Time-skip and cheats | `web/components/world/DevPanel.tsx` |
| The woodland walk | `web/components/world/AdventureView.tsx` |
| Which view is showing | `web/app/page.tsx` |
| Any styling at all | `web/app/globals.css` (one file, no CSS modules) |
| A contract rule | `contracts/src/Garden.sol` and its libraries |

---

## 04 — `web/` in detail

### `web/lib/world/` — the model

Plain TypeScript. No React except the one hook. **This is where the game is.**

| File | Holds |
|---|---|
| `mechanics.ts` | Constants copied from Solidity: `HEALTH_MAX`, the requirement range, `Decay`, the `WaterCurve`. Every one cites its source line |
| `plants.ts` | Species table, and `stepPlant()` — one pure function containing every rule about growing, healing and dying |
| `economy.ts` | The farm, the coordination threshold, `produce()` |
| `map.ts` | The garden as data: tiles, the plot rect, fences, exits, collision |
| `camera.ts` | World coordinates → screen. Reads tile size and anchors from `art/manifest.json` |
| `worldgen.ts` | Procedural 128×128 world for the World view. Not used by the home garden |
| `useGarden.ts` | The only stateful thing. Wires the pure parts together and holds React state |

> **`stepPlant()` is the piece worth protecting.** It takes a plant and a
> boolean and returns a plant. No React, no DOM, no randomness. If you want to
> test the rules, that function is the whole ruleset and you can call it in a
> loop.

### `web/components/world/` — the views

| File | Renders | How |
|---|---|---|
| `Overworld.tsx` | The home garden | DOM sprites, painter's order by world *y* |
| `AdventureView.tsx` | The woodland walk | Tiled PNG + foreground layer on one transform |
| `WorldView.tsx` | The whole world | **Canvas** — 16k cells, no DOM per plot |
| `Hud.tsx` | The side panel | Plain React |
| `DevPanel.tsx` | Test harness | Plain React |

The renderers differ on purpose: World has to survive being big, Patch has to
occlude, Adventure has to have depth. See `VIEWS-AND-ECONOMY.md` §01.

### The rest of `web/`

- `app/page.tsx` — the view switch, and the only place `useGarden()` is called.
- `app/globals.css` — **all** styling, ~670 lines, in sections.
- `components/challenges/` — the seed phrase (real) and two placeholder puzzles.
- `lib/challenges/` — `sealed.json` is the encrypted reward; there is no
  plaintext answer in the repo. `web/scripts/seal.mjs` regenerates it.
- `lib/contracts.ts`, `lib/queries.ts` — the chain and subgraph seams. **Not
  called by the game yet.** This is where wiring starts.

---

## 05 — `art/` in detail, and the thing that confuses everyone

**There are two art systems in this folder and they do not talk to each other.**

### System A — the registered tileset (used by the app)

```
art/manifest.json      the registry: every asset, its anchor, its size
art/world/*.svg        the overworld tileset the game actually draws
art/tokens.css         colour tokens
art/creatures/, ui/    registered but not yet drawn by the app
```

The app finds these through `manifest.json`. Sprite **anchors** live there —
the point in an asset's own viewBox that lands on a tile's ground centre. A
sprite that hovers or sinks has a wrong anchor, not a wrong drawing.

`art/tools/build_world.py` generates `art/world/` procedurally (watercolour
washes, paper grain). Run it to regenerate; edit it rather than the SVGs if you
want a systematic change.

### System B — folder-per-view previews (not wired to anything)

```
art/backgrounds/<view>/<view>-preview.html   +   that view's art
```

Standalone HTML. Opens in a browser with no server and no build. This is where
art gets iterated fast. `art/backgrounds/README.md` documents the convention.

Three exist: `stroll/`, `garden-state/`, `temp-home-garden/`.

> **They are prototypes, not the game.** `temp-home-garden-preview.html` and
> the app's Overworld render the *same* garden from *duplicated* code. Keep
> them in step by hand, or pick one and delete the other — this has already
> caused one "localhost doesn't look like the screenshot" confusion.

### How the app reaches art at runtime

`web/package.json` has a `linkart` script that symlinks `art/` →
`web/public/art` before dev and build. That is why paths look like
`/art/world/tile-grass.svg`. If images 404, that symlink is missing.

---

## 06 — `contracts/` in detail

| File | Job |
|---|---|
| `src/Garden.sol` | The world. Plots, epochs, settlement. 556 lines, the big one |
| `src/Well.sol` | The shared water. Debited face value, always |
| `src/Farm.sol` | Communal nutrients, and the coordination threshold |
| `src/libraries/WaterCurve.sol` | Diminishing returns on a draw — the core asymmetry |
| `src/libraries/Decay.sol` | Health lost per untended epoch |
| `src/randomness/` | Chainlink VRF, and a mock that lets tests choose the roll |
| `src/art/` | `IPlotArt` — the on-chain art swap point |
| `test/Garden.t.sol` | Tests named after *design properties*, not functions |
| `script/local-seed.sh` | One command: deploy, queue plots, warp, start |

**Read `test/Garden.t.sol` before changing a contract.** Several tests guard
asymmetries that look like bugs; each has a comment saying why.

---

## 07 — What is real and what is scaffolding

| Real | Scaffolding |
|---|---|
| Contracts compile, tests pass, local deploy works | The web app never calls them |
| The plant loop, seeds, dust, the commune | All client-side, resets on refresh |
| Camera, collision, occlusion, three views | Neighbours are fixtures, not players |
| The seed phrase, genuinely encrypted | Two challenge puzzles are placeholders |
| `subgraph/` schema and mapping exist | Nothing indexes anything yet |

**The seam to wire first** is `useGarden.ts`. Every mutation in it names the
contract call it stands for. Replacing its internals with wagmi writes should
not change a single number on screen — if it does, the mirror in
`mechanics.ts` has drifted from Solidity.

---

## 08 — Known drift, so it doesn't surprise you

- **`ART.md` says `ArtLayer.tsx` is the only file that knows where art lives.
  That is no longer true** — `camera.ts`, `AdventureView.tsx`, `page.tsx` and
  `globals.css` all reference art paths directly. Either re-centralise or
  update the claim.
- **`art/backgrounds/Stroll.png` is a stale orphan.** A different file from
  `art/backgrounds/stroll/Stroll.png` (different checksum), left behind when
  the folders were reorganised. Nothing references it.
- **The home garden exists twice** — see §05.
- **`ig-src.tgz`** in the repo root is a build tarball, gitignored, safe to
  delete.
- **`DevPanel.tsx` ships cheats**, including a toggle that reveals the hidden
  requirement. Gate it on an env flag or delete it before anyone plays.

---

## 09 — Running it

```bash
# contracts (optional — the web app does not need them yet)
cd contracts && cp .env.example .env
forge build && forge test -vvv
anvil                        # another terminal
./script/local-seed.sh       # deploy, join, warp, start

# the game
cd web && npm install && npm run dev      # localhost:3000

# an art preview — no server needed
open art/backgrounds/temp-home-garden/temp-home-garden-preview.html
```

If `localhost:3000` looks stale or blank, it is usually a leftover dev server:
`lsof -ti:3000 | xargs kill`.
