# Mechanics and parameters

Every number in the game, what it does, and which direction to move it when
something feels wrong. **All of these are public on-chain by design** — players
can compute their exact odds. Only the roll is hidden.

---

## The epoch

24 hours. One `settleEpoch` per epoch, permissionless, bounty-paid.

```
epoch N opens ──▶ players act ──▶ settleBegin() ──▶ VRF ──▶ onRandomness()
                                  locks epoch N            rolls x, counts,
                                                           refills, evaluates
```

### Why 24 and not 12

The epoch length is not really a pacing dial. It is **how long a player may be
away before they start losing**, and that is the number that decides churn.

Decay is one point of health per missed epoch, and a Clover has six. So:

| Epoch | A weekend away | Total absence that kills a Clover |
|---|---|---|
| 24h | −2 health | 6 days |
| 12h | −4 health | 3 days |

At 12 hours a busy week costs you the garden. In a game whose stated failure
mode is *people giving up*, punishing ordinary life is the one thing the design
cannot afford — every player who quits shrinks the frontier, which is the
thing §04 says we are measuring. Twelve-hour epochs buy engagement by charging
retention, and retention is the win condition.

24 hours also lands the growth and death clocks in a sensible ratio: a Clover
matures in four days and dies in six, so a plant you are actually tending
outruns its own decay. Shorten the epoch and that ratio is unchanged — but the
**wall-clock forgiveness** halves, and forgiveness is all the ratio was buying.

**The real lever is not epoch length, it is grace.** `OfflineMode` plus
`Decay.SLOW` and `GRACE_EPOCHS = 7` already exist: leaving a standing
instruction before you go buys a week at reduced decay. That is what makes 24h
survivable for someone with a job, and it is a *choice with a cost* rather than
immunity. Tune that before you touch `Epoch.DURATION`.

One practical note: `Epoch.DURATION` is a single constant in
`contracts/src/libraries/Epoch.sol`, so this is a deployment parameter, not an
architectural decision. Nothing about a demo requires shortening it — that is
what the web build's test harness is for.

---

## The commons, sized by population

Everything shared scales with **active patches** — a patch with at least one
living plant. Not signups, not addresses.

| Per active patch | Value | Meaning |
|---|---:|---|
| `REFILL_PER_PATCH` | 150 | Well refill, and the ceiling on one patch's share |
| `CAPACITY_PER_PATCH` | 600 | Four epochs of buffer — what a panic eats |
| `COMMUNE_GOAL_PER_PATCH` | 25 | Ether dust asked of each patch per cycle |

---

## Water, per plant

**Water is given to plants one at a time**, and each plant is judged against
its own requirement. Pooling it would throw away the only decision that
matters when the well is short: *which plant do you save*.

### The roll is a base, not a requirement

One **base** is rolled per epoch, uniform over `{20,25,…,80}`, mean exactly 50.
Each plant needs `round(base × its own thirst)`.

| Species | Thirst | Needs, at base 20–80 | Mean |
|---|---|---|---:|
| Clover | ×1.0 | 20 – 80 | 50 |
| Marigold | ×1.2–1.5 | 24 – 120 | 68 |
| Foxglove | ×1.6–2.0 | 32 – 160 | 90 |
| Moonflower | ×2.0–3.0 | 40 – 240 | 125 |

A plant rolls its own multiplier out of the species band **when sown and keeps
it for life**. So your particular Moonflower's thirst is a fact you can read
off it; the base is the only thing hidden. One layer of unknown, not two —
doubly-unknown water would make rare plants a lottery rather than a commitment.

### The identity the whole economy is built on

```
3 Clover × 50 mean need  =  150  =  REFILL_PER_PATCH
```

Three Clovers is exactly break-even against the well, so a patch that size
meets its requirement about **half the time** on a fair share. Everything else
is priced against that.

### A fair share is per plant, not per player

`fairShare = min( meanNeed(thirst), REFILL_PER_PATCH, well / patches )`

The first term is the important one and it was a bug before: a lump sum of 150
handed to a patch with one plant made that plant *immortal*. A Foxglove's worst
case is `1.8 × 80 = 144`, which fits inside 150 — so it never missed, never
lost health, and still out-earned three Clovers. Concentration was strictly
dominant. Scaling the entitlement by thirst puts every composition back on the
same coin flip:

| Patch | Thirst | Share | Meets |
|---|---|---:|---:|
| 3 Clover | ×3.0 | 150 | 54% |
| 1 Marigold | ×1.35 | 68 | 54% |
| 1 Foxglove | ×1.8 | 90 | 54% |
| 1 Moonflower | ×2.5 | 125 | 54% |

**Rarity no longer buys water safety.** It buys dust, and it costs fragility,
slower healing, and the ceiling below.

### The ceiling, and where the next features go

`REFILL_PER_PATCH` caps a share at 150 however much you plant, so anything
above thirst ×3.0 is **structurally short** — not expensive, impossible:

| Patch | Mean need | Allotted | |
|---|---:|---:|---|
| 3 Clover | 150 | 150 | sustainable |
| 1 Moonflower | 125 | 125 | sustainable |
| 1 Moonflower + 1 Clover | 175 | 150 | short |
| 3 Moonflower | 375 | 150 | short |

That wall is deliberate. **A second well, lucky rain and water items are what
move it** — they are the only things that can, which is what makes them worth
building rather than decorative.

### Certainty

`drawCap = 80 × thirst` — exactly enough to be sure everything you planted is
watered, whatever base lands. For three Clovers that is 240 against a 150
share: **1.6× your share, always**, whatever is in the ground. Planting more
does not change the price of safety, only what safety costs in absolute water.

There is no `WaterCurve` in this path any more. The curve gave diminishing
credit on a draw, which made sense when water fed a health bar. Water now meets
a threshold, and a threshold is binary — over-watering is already worth
nothing, so a curve would be a second answer to a question that has one.

### The dead patch

Death consumes the seed. Lose every plant and every seed and you cannot act at
all — watering does nothing, there is nothing to tend. Two ways back, both
requiring somebody else's world:

1. **Another gardener gives you a seed.**
2. **You find one in the woodland**, once per epoch.

This is the only terminal-looking state in the game, and it is deliberately not
terminal. A game about continuing cannot have a dead end you reach by being
busy — but it can have one you need help out of.

---

## Water — the tragedy axis

The shared well. One-sided: more for you is less for everyone.

| Parameter | Value | Effect if raised |
|---|---:|---|
| `WaterCurve.SOFT_CAP` | 100 | Bigger "free" draw; weakens the dilemma |
| `WaterCurve.HARD_CAP` | 250 | More room to waste; raises worst-case drain |
| `Well.capacity` | 10,000 | More buffer; slower, gentler seasons |
| `Well.refillPerEpoch` | 800 | The real difficulty dial. Lower = tighter |
| `WELL_FLOOR_BPS` | 2,000 | Higher = epochs count as healthy less often |

### The curve

```
credited
  175 ┤                    ┌───────────────  zero marginal benefit
      │                ┌───┘
  100 ┤        ┌───────┘                     half credit
      │    ┌───┘
      │┌───┘                                 full credit
    0 └┴───────┬───────┬──────────────────▶ raw drawn
      0       100     250
```

**The well is debited the raw amount at every point on this curve.** Past 250
you are burning the commons for literally nothing. That asymmetry is the whole
mechanic and it does something specific: it makes *calculated* greed
self-limiting, so the genuinely destructive behaviour is **panic** — drawing
defensively against an unknown requirement. Precautionary hoarding, the
bank-run shape. That's a more interesting villain than a rational optimiser,
and it's a real documented commons failure you can name in a pitch.

### The requirement

| Parameter | Value | Note |
|---|---:|---|
| `REQ_MIN` | 20 | Range is **public** |
| `REQ_MAX` | 80 | |
| `REQ_STEP` | 5 | Rolls land on bucket boundaries so the count is exact |

Each epoch every plot must have received at least `x` credited water, where `x`
is rolled uniformly from `{20, 25, … 80}` **after all draws are locked**.

This single mechanic generates the corridor without anyone authoring a band:

- Draw too little → you may miss `x` → your plot decays.
- Everyone draws defensively → the well empties → *everyone* misses `x`.

The expected requirement is 50. A player drawing exactly 50 meets it about half
the time. A player drawing 80 always meets it and costs the commons 60% more
than necessary. Whether that is prudence or greed is genuinely undecidable from
the ledger, which is the point.

---

## Nutrients — the growth axis, and the stagnation floor

Bought from the communal farm, which players feed with seeds.

| Parameter | Value | Effect |
|---|---:|---|
| `NUTRIENT_FLOOR` | 300 | Health a plot needs to count toward completion |
| `Farm.baseProduction` | 50 | Free floor of nutrients per epoch |
| `Farm.COORDINATION_THRESHOLD` | 40 | **Seeds below this in an epoch produce nothing** |
| `Farm.SEED_YIELD` | 3 | Conversion once the threshold clears |
| `Farm.LABOUR_YIELD` | 2 | Per logged-off farm worker, capped by seeds present |

### The coordination threshold

From the architecture doc: *"adding plants to the farm is useless if there's
not enough work behind it."* Contributions under the threshold are wasted
**entirely**.

This makes the farm a **coordination game**, not a public-goods game.
Contributing is only rational if you believe others will contribute too, which
is the thing that forces players to actually talk to each other. Do not soften
this into a linear payout to make it "fairer" — the discontinuity is the
feature.

Labour multiplies work that already exists and is capped by seeds present:
farm workers with nothing to tend achieve nothing, on purpose.

---

## Decay, and logging off

| Parameter | Value | Note |
|---|---:|---|
| `Decay.NORMAL` | 120/epoch | ~8 epochs from full to dead |
| `Decay.SLOW` | 45/epoch | With a "work your plot" instruction |
| `Decay.GRACE_EPOCHS` | 7 | How long an instruction holds |

Leaving an instruction before you log off is a **choice with a cost**, not
immunity. After the grace window normal decay resumes, so going away
well-prepared buys you a week — otherwise abandonment stops being one of the
game's three stated failure modes.

---

## Entry, exit, and the stake

| Parameter | Value |
|---|---:|
| `STAKE` | 0.001 ETH |
| `SETTLE_BOUNTY` | 0.0001 ETH |
| Wilderness reversion | `2 × GRACE_EPOCHS` = 14 untended epochs |

| Exit | Stake |
|---|---|
| `cede(plotId, to)` — hand off cleanly | Refunded |
| Level completion or collapse, having tended | Refunded |
| Dormant until wilderness | **Forfeited to the Stewardship Pool** |

One primitive doing three jobs: a Sybil toll, an exit incentive, and the
funding for the people who clean up after whoever left.

**The tension to keep in view:** the stake fights the win condition. 0.001 ETH
is trivial as money — the real barrier is requiring a funded wallet at all,
which cuts acquisition hard, and level completion *needs* acquisition. That's
what sponsorship and embedded wallets are for (see `INTEGRATIONS.md`).

**Why most Sybil attacks aren't attacks here:** every right attaches to a
*tended plot*, not to an address — water, nutrients, voting weight,
eligibility. An attacker who wants any of those has to actually tend a thousand
plots, at which point they're not attacking the game, they're playing it very
enthusiastically.

---

## Player-count bands

Rules scale with population. Bands change *thresholds*, never the resource
curves.

| Players | `requiredStreak` | `healthyBps` | Status |
|---|---:|---:|---|
| 1–10 | 5 | 6,000 | Tune first — this is what you'll demo |
| 11–100 | 10 | 6,000 | Tune second |
| 101–1,000 | 15 | 6,500 | Sketch only |
| 1,001+ | 20 | 7,000 | Sketch only |

Currently hardcoded to the 11–100 row in `_isHealthyEpoch` and
`_evaluateSeason`, both marked `TODO(mechanics)`. Express thresholds as
*proportions of active plots*, never headcounts, so one set of tuning works at
40 players and at 4,000.

---

## Two shapes of failure

Deliberately not the same, because they mean different things.

### Depletion — a roll

Hazard rises with stress; the roll happens at settlement. Currently well-level
only, ramping 0 → 4,000 bps as the well falls from the floor to empty.

`TODO(mechanics)` — fold in the rest:

| Stress input | Status |
|---|---|
| Reservoir depletion | Implemented |
| Soil depletion (over-band nutrient draw) | Not wired |
| **Stagnation** (under-band draw) | Not wired |
| Neglect — proportion untended | Not wired |
| Area outrunning labour | Not wired |
| Voting concentration (HHI) | Needs voting first |
| Quorum failures | Needs voting first |

The formula is public. Players can compute their exact odds every epoch and
still not know the outcome — *hide the roll, not the rules*. This also removes
the "the devs rigged it" attack surface entirely, which a hidden constant never
could.

### Stagnation — a timeout

`MAX_EPOCHS` = 120. The level expires undone: nothing dies, nothing heals,
collectibles stay locked. Quieter and sadder than a collapse, and a genuinely
different thing to have to explain to your community afterwards.

---

## Level completion

All at once:

1. Area above threshold (needs real active players)
2. Tended ratio above `healthyBps` for `requiredStreak` **consecutive** epochs
3. Well never breaching its floor during that window
4. Nutrient floor met by enough plots during that window

Condition 2 is the one that matters: **duration is the only requirement that
cannot be bought**, and it's what makes a collapse at epoch N−1 devastating.

On completion every collectible unlocks at once and every scar heals. A healed
scar should be rarer and more valuable than no scar — carrying one means the
holder survived a collapse *and* stayed through to a completion, which is
precisely the behaviour nothing else in the game can incentivise.

---

## Tuning order

When it feels wrong, reach for these in order:

1. **`Well.refillPerEpoch`** — the master difficulty dial. Everything else is
   secondary.
2. **`REQ_MAX − REQ_MIN`** — widen for more anxiety, narrow for more solvable.
3. **`Farm.COORDINATION_THRESHOLD`** — how much collective effort before
   anything works.
4. **`requiredStreak`** — how long the community must hold it together.
5. **`Decay.NORMAL`** — how punishing absence is.

Change one at a time. These interact more than they look like they do.
