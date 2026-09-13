# Views and the seed economy

Three views, and the loop that connects them. This doc decides two things that
`DESIGN.md` left open: **where the player is looking**, and **what a garden
actually produces**.

It is written to be argued with. Sections marked **OPEN** are not decided.

---

## 01 — Three views, three questions

A view earns its place by answering a question the others cannot. If two views
answer the same question, one of them is zoom, and zoom is not a view.

| View | The question | Camera | Renderer |
|---|---|---|---|
| **Patch** | *How is my garden?* | Pitched grid, `tileH/tileW = 0.625` | DOM sprites |
| **World** | *How is the world?* | Far off, whole garden in one frame | **Canvas** |
| **Adventure** | *What is out there?* | Side-on woodland, parallax | DOM layers |

### Why the renderers differ

This is not an implementation detail, it is the reason the views are separate
programs rather than one camera with three zoom levels.

**World must survive being big.** "Prepare as if it will be big" means
thousands of plots, and one `<img>` per plot dies somewhere around two thousand
DOM nodes — long before the world is interesting. So World is a canvas that
draws plots as coloured cells, and it never instantiates a sprite. The
consequence to accept up front: **World cannot show detail, ever.** Not a
compromise — a spec. Detail is what Patch is for.

**Patch must occlude.** Walking behind a tree has to hide you, and that is
painter's order over real sprites with real anchors. Tens of elements, not
thousands. DOM.

**Adventure must have depth.** Parallax layers of painted canopy, and the
player between them. A handful of big elements. DOM.

### What each view is forbidden from doing

| View | Must never |
|---|---|
| Patch | Show more than the immediate neighbourhood. It is not a map |
| World | Show a number. If the world's health needs a readout, the colour has failed |
| Adventure | Show your plot, the well, or the HUD. You left |

That last one is the load-bearing one. Adventure is where you are **not**
tending, and the cost of being there has to be felt — see §04.

---

## 02 — Patch: your own garden, most of the frame

Your patch grows from 3×3 beds to **5×5**, and the zoom roughly doubles, so
your own garden is about 70% of the viewport and four neighbours are cut off at
the frame edges across the lane.

The neighbours are present at exactly the fidelity needed to read their health
band and nothing more. Present enough that the world is shared; small enough
that they do not compete with your own rows for attention.

> One contract plot is one walkable patch. The 5×5 is a *rendering* of a single
> `Plot` struct, not 25 of them. Everything the player does in Patch resolves to
> one `plotId`.

---

## 03 — World: health without a number

Whole garden, one frame, drawn as cells. The only channel is colour, and the
palette is the health band — so a sick world is legibly sick from across a
room, which is the `ART.md` brief applied at world scale.

Fog is ungrown ground, and it tracks **tended** plots rather than signups, so
a wave of people quitting visibly pulls the coastline in. Losing ground is a
thing you watch happen.

**Creatures are the dashboard** (`DESIGN.md` §03). At world scale a legendary
sighting is a mote of light and nothing else is drawn — no plot detail, no
labels, no meters. You should be able to tell that the herons have gone without
being told how bad it is, which is `P3` exactly.

---

## 04 — Adventure: the woodland, and the cost of leaving

Painted woodland (`art/backgrounds/Stroll.png`). Challenges are **found**, not
listed: they sit behind trunks and in clearings, and the only way to know a
clearing holds something is to walk into it.

### Being away has to cost something

Adventure is time not spent watering, and the epoch does not pause. That is the
whole tension of the view and it should not be softened:

- Decay runs while you are out (`Decay.NORMAL`, 120/epoch).
- If you are out when settlement lands, you drew whatever you had drawn.
- Leaving an instruction first (`setOfflineMode`) buys `GRACE_EPOCHS` of
  `Decay.SLOW` — a week, not immunity.

So Adventure is a **wager**: a lumpy, uncertain seed payout against certain
decay at home. A player who lives in the woodland loses their garden, and a
player who never leaves it never gets the seeds to grow anything rare.

**OPEN** — whether Adventure should cost an explicit action (an epoch's draw
forfeited) on top of decay. Decay alone may be too gentle a price once players
learn to pre-water.

---

## 05 — What a garden produces

`DESIGN.md` §03 says seeds come from challenges. `OPEN-QUESTIONS.md` says the
challenge loop is deferred because *"seeds are unmetered today —
`contributeSeeds` doesn't debit an inventory that doesn't exist."*

**That inventory is the thing this work adds.** Everything else here follows
from giving seeds a home.

### Two sources, deliberately different shapes

| Source | Shape | Why |
|---|---|---|
| **Your garden, at settlement** | Small, reliable, scales with health band | The baseline. A tended plot always earns something |
| **Adventure challenges** | Large, rare, requires leaving | The reach. Lumpy and uncertain |

This mirrors water on purpose: a reliable floor and a risky reach. If gardens
yielded nothing, the only economic input would be puzzles, which does not scale
past the people who enjoy puzzles. If gardens yielded plenty, Adventure would
be decoration.

**Garden yield is a design extension, not something `DESIGN.md` already says.**
Flagged as such. The tuning constraint is the only part that matters:

> Garden yield must be small enough that a player who never leaves cannot reach
> a T4 collectible, and large enough that a player who never solves a puzzle
> still plays.

### Proposed yield

| Band | Seeds per epoch |
|---|---:|
| thriving | 3 |
| steady | 1 |
| stressed | 0 |
| dying | 0 |

Yield keys off the band already on screen, so the player can see next epoch's
income by looking at their garden. No hidden state.

---

## 06 — The fork: keep or give

From `DESIGN.md` §03, unchanged: *"Keep it — improve your own plot now,
certainly. Give it to the farm — improve everyone's nutrient supply, maybe."*

| Action | Yield | Certain? | Whose? |
|---|---|---|---|
| **Plant** — `plantSeeds(plotId, n)` | `n × 1` nutrient health | Yes | Yours |
| **Give** — `contributeSeeds(plotId, n)` | `n × 3` to farm stock | **Only if the epoch's total clears 40** | Everyone's |

Giving is three times better and might be worth nothing at all. That is the
coordination game, and `Farm.sol` already enforces it:

```
if (seedsThisEpoch >= COORDINATION_THRESHOLD) stock += seedsThisEpoch * SEED_YIELD;
// else: the seeds are simply gone
```

Do not soften the discontinuity into a linear payout to make it feel fairer.
The cliff is what makes players talk to each other.

### `plantSeeds` does not exist yet

`Garden.sol` has `buyNutrients` and `contributeSeeds`. It has no way to plant a
seed on your own plot, so the "keep" half of the fork is currently unspendable.
Needs a new function, and it is the smallest contract change here:

```solidity
function plantSeeds(uint256 plotId, uint32 amount) external;   // + PLANT_YIELD = 1
```

### The hole: buying is free

`buyNutrients` debits farm **stock** and costs the caller nothing. So a player
who contributes no seeds can still buy from a stock other people funded — a
free rider with no friction at all.

This is not a bug in the code, it is an unfinished decision, and it is the most
important **OPEN** item in this doc. Options, none free:

| Option | Cost |
|---|---|
| Cap purchases per plot per epoch | Simple, keeps the coordination game intact, arbitrary number to tune |
| Price nutrients in seeds | Kills the fork — seeds become money, not a choice |
| Allocate stock pro-rata to contribution | Kills the coordination game — giving becomes a private investment |
| Leave it | Free riding is *supposed* to be possible. Ostrom's problem is not that defection is impossible, it is that it is visible |

My read: **cap per epoch, and make the ledger show who gave.** Ostrom's design
principles are about monitoring, not prohibition — the answer to free riding in
this game has always been that everyone can see you do it.

---

## 07 — The loop, end to end

```
   water the well  ──►  health stays above decay
                             │
                             ▼
                    settlement yields SEEDS  ◄──── Adventure challenges
                             │                      (lumpy, uncertain)
                    ┌────────┴────────┐
                    ▼                 ▼
              PLANT (n×1, sure)   GIVE (n×3, maybe)
                    │                 │
                    │                 ▼
                    │           farm stock ──► anyone buys nutrients (free)
                    ▼                 │
              nutrientHealth ◄────────┘
                    │
                    ▼
        above NUTRIENT_FLOOR (300) ──► plot counts toward completion
                    │
                    ▼
          sustained quality ──► collectibles
                                 T1–T3 your own plot (certain, private)
                                 T4–T5 garden-tier (collective, impossible alone)
```

Read it once and the shape is clear: **every private-certain path caps out at
T3.** The rare things are gated by a state the world can only reach together,
so greed does not merely risk them — it makes them unmintable.

---

## 08 — The seed phrase

One challenge, hidden in the woodland. Twelve words to supply, seven given as
scaffolding, nineteen slots:

> **(A)** \_\_ \_\_ **(is)** \_\_ \_\_ **(the)** \_\_ **(of)** \_\_ **(An)** \_\_ \_\_ \_\_ **(the)** \_\_ **(of)** \_\_ \_\_

The answer is the project's own thesis — Carse, 1986 — which is why the reward
is information rather than resource. Solving it reveals the lore and marks where
other Adventure challenges hide. **No mechanical advantage**, because
`DESIGN.md` §06 is explicit: *rewards can be unequal, powers cannot.* A player
who solves a word puzzle must not get an edge over the commons.

### The unlock is real, not a boolean

The reward text is **encrypted with the phrase as the key** (PBKDF2 + AES-GCM,
ciphertext in the bundle). There is no `if (answer === "...")` to read in
devtools and no plaintext to find, because the plaintext is not shipped. You
cannot read the reward without producing the phrase.

Honest limitation: a client-side gate is not a secret. The phrase is guessable
by anyone who knows the quote, and a determined player can brute-force against
the ciphertext offline. Encryption raises the floor from *"open devtools"* to
*"actually solve it or actually attack it"*, which is the right bar for a
hidden lore unlock and the wrong bar for anything load-bearing. Do not gate a
resource this way.

### Hints are found, not given

Hints are themselves hidden in the woodland, and they are oblique on purpose —
the brief was hard and confusing. They point at the *structure* of the phrase
rather than its words:

- Three of the twelve you must supply are said twice. None is the answer.
- Nothing here is a BIP-39 word. If you are reaching for a wordlist you have
  mistaken the lock.
- The first half ends. The second does not.
- Both halves ask the same question of the same noun.
- What a finite player wants, an infinite player refuses to want.
- One man wrote it in 1986, and he was not writing about gardens.

### ⚠ The authored phrase differs from the quotation

Carse's sentence ends *"...for the purpose of continuing **the** play."* The
authored answer drops that "the", which is what makes the count land on exactly
twelve. Anyone who knows the quote will type the real ending and fail.

**Decide deliberately:** accept both endings, or keep twelve and let the
mismatch be part of the difficulty. Twelve is a better number and a worse
quotation. Currently: twelve, strict.

---

## 09 — Built, and what is still a stub

Verified by building and play-testing, not by reading the code: watering debits
the well and credits the curve, the fork spends a real inventory, the cliff copy
tracks, hints are found in the woodland, a cache pays seeds through a
placeholder puzzle, and the phrase decrypts its reward.

| Real | Stub |
|---|---|
| Three views, three renderers | All state is client-side (`useGarden`) |
| Seed inventory, plant/give fork | `Garden.plantSeeds()` does not exist yet |
| `Farm.produce()` with the cliff | Neighbour health is fixture noise |
| World generator at 128×128 | Health is smooth noise, not the subgraph |
| Seed phrase, encrypted unlock | Two cache puzzles are placeholders |
| Adventure finds, per-epoch respawn | No walk-cycle frames; the sprite bobs |

### Two things the build taught us

**Parallax must be a transform, not a background-position.** Three
full-viewport layers moving by `background-position` repaint every frame and
measured ~17fps headless — slower than everything else in the game combined.
`translate3d` is compositor-only and the layer rasterises once. The layers are
therefore wider than the viewport by the length of the walk.

**Health has to be spatially correlated.** Per-plot random health at one pixel
per plot renders as television static: no regions, no story, nothing to read.
It is also untrue — neighbours share a well and an adjacency bonus, so
neighbourhoods thrive or fail together. Smooth noise gives the world a sick
east and a healthy north-west, and *that* is a thing you can point at.

## 10 — Demo pacing, and why the numbers were not raised to fix it

`PLANT_YIELD` is 1 against the farm's 3, and a thriving plot yields 3 seeds an
epoch. At those numbers crossing `NUTRIENT_FLOOR` takes many epochs, which is
correct for a 24-hour epoch and slow for a demo.

The fix is a shorter epoch, **not** bigger constants. Scaling yields to make
progress feel quicker changes the ratio between planting and giving, and that
ratio is the only thing the fork is testing. A prototype tuned for the demo
tells you how the demo feels.
