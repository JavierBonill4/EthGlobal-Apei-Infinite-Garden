# Architecture

How the code is shaped, and why. For *what the game is*, read `DESIGN.md`
first — this assumes it.

---

## The constraint everything obeys

> Every mechanic must be expressible as **state at epoch N derived from actions
> during epoch N−1.**

Anything that can't be gets cut. This is not a stylistic preference; it is the
only shape that fits on-chain at a cost players will tolerate. Discovering it
during implementation instead of during design means redesigning under
deadline.

Three consequences run through the whole codebase:

1. **Nothing iterates over plots.** Not at settlement, not anywhere. A loop
   over players is a loop that stops working at exactly the player count the
   win condition needs.
2. **Decay is lazy.** A plot's health is never written every epoch — it is
   derived on read from `lastTendedEpoch`. An idle plot costs nothing until
   somebody touches it.
3. **Aggregates are maintained incrementally.** Counters move by ±1 during
   player actions, never recomputed by scanning.

---

## Contract map

```
                    ┌──────────────────┐
                    │ IRandomnessSource│  swappable: Mock | ChainlinkVRF
                    └────────┬─────────┘
                             │ requestRandomness / onRandomness
                             ▼
   Well.State ──┐    ┌───────────────┐    ┌──────────────────┐
                ├───▶│    Garden     │───▶│  StandingRecord  │ soulbound, mutable
   Farm.State ──┘    │  (core world) │    ├──────────────────┤
                     └───────┬───────┘    │   Collectibles   │ locked until completion
                             │            └────────┬─────────┘
                             │                     │ tokenURI
                             ▼                     ▼
                        libraries/            ┌──────────┐
                    Epoch, Decay, WaterCurve  │ IPlotArt │ ← art swap point
                                              └──────────┘
```

`Well` and `Farm` are **libraries over structs stored in Garden**, not separate
deployed contracts. One deployable core keeps settlement in a single
transaction and avoids a cross-contract authorisation surface nobody has time
to audit before a deadline.

---

## The settlement dance

This is the most important flow in the system and the easiest to get subtly
wrong.

```
   during epoch N            settleBegin()             onRandomness()
   ───────────────           ─────────────             ──────────────
   players drawWater()  ──▶  locks the epoch    ──▶    rolls requirement x
   buyNutrients()            requests a word           counts met vs missed
   contributeSeeds()         (caller cannot see it)    refills well, farm produces
                                                       evaluates the season
                                                       pays the caller a bounty
```

**Why two phases.** `settleBegin()` is permissionless — anyone can advance the
world, and there's a bounty so somebody always does. If the roll came from
`block.prevrandao`, the caller could read it *before* deciding whether to
call, and simply decline to settle epochs whose outcome they disliked. That
hands one anonymous person control over the world's fate. VRF's request/fulfil
split forces the caller to commit before the word exists.

**Why the requirement is revealed last.** If players could see `x` while they
still had a turn, they would draw exactly `x` and there would be no dilemma at
all. The range is public; the draw is not; and the reveal happens after every
action for that epoch is locked.

---

## The histogram trick

Settlement needs to know *how many plots met the requirement* — a per-plot
comparison across the whole world, which is exactly the loop we're not allowed
to write.

Instead, `Garden` maintains a bucketed histogram of credited water per epoch:

- Buckets span the requirement range `[REQ_MIN, REQ_MAX]` in `REQ_STEP` units.
- Bucket `0` (below the range) is **never stored** — plots that did nothing are
  derived as `activePlots − Σ(buckets)`, which keeps joining free.
- Each `drawWater` call moves a plot between buckets in O(1).
- The requirement is **always rolled onto a bucket boundary**, so the count at
  settlement is *exact*, not approximate. This is the reason for `REQ_STEP`.

Settlement is then O(BUCKETS) — currently 14 SLOADs — regardless of whether
there are 10 players or 10,000.

---

## Storage layout notes

`Plot` packs into 3 slots. Two fields deserve explanation:

| Field | Meaning |
|---|---|
| `lastTendedEpoch` | The epoch through which **decay has been accounted** — an accounting marker, not a reward. `_syncPlot` advances it because the decay it represents has now been applied. Whether the plot is in good shape is a separate question, answered by its health values. |
| `actedMarker` / `nutrientMarker` | `epoch + 1` of the last action. The `+1` offset exists so that epoch 0 is distinguishable from "never acted" without a separate boolean. |

The marker offset is a small thing that caused a real bug during scaffolding:
without it, every plot silently failed to count as tended during the first
epoch of a season.

---

## Tokens

| Contract | Standard | Behaviour |
|---|---|---|
| `StandingRecord` | ERC-721 + ERC-5192 | One per player. `locked()` returns `true` unconditionally. Never revoked. Mutable art. |
| `Collectibles` | ERC-721 + ERC-5192 | `locked()` reads through to a **per-season** flag, so a completion unlocks every token from that season in O(1) rather than per token. |

`SoulboundERC721` is hand-rolled rather than inherited from OpenZeppelin. In a
soulbound token roughly ninety percent of the ERC-721 machinery exists only to
revert — approvals, operators, safe-transfer callbacks are all dead weight, and
inheriting them invites someone to "fix" a revert later. The hand-rolled
version is short enough to audit by reading.

ERC-5192 standardises `locked()` and requires transfers to revert while locked.
It says **nothing about unlocking**, so the completion unlock is our own logic
— legitimately so, not a standards violation.

### Scars are collective

`Collectibles.markCollapse(season)` marks a whole season's mints, not
individuals. This is a deliberate reversal of an earlier design: defacing one
player's property over a collective outcome was heavy-handed, and under the
corridor model the "greedy" player may well have been the one who kept the
world moving. Provenance, not punishment.

---

## The art boundary

Everything visual sits behind `IPlotArt`. The game never renders anything
itself. Two swap points, both live, both replaceable without touching game
logic:

- **On-chain:** deploy a new `IPlotArt`, call `setArt()`. Governs what token
  holders see.
- **Off-chain:** `art/manifest.json` + `web/components/art/ArtLayer.tsx`.
  Governs the app.

They are allowed to differ in fidelity. They must not differ in *meaning* —
the health-band thresholds are duplicated in `PlaceholderArt.sol` and
`manifest.json`, and if they drift a plot will look thriving on-chain and dying
in the app.

---

## What is deliberately not built yet

| Area | Status | Why it waits |
|---|---|---|
| Challenge loop (gold, seeds, rare items) | Stub | Seeds are unmetered today; `contributeSeeds` doesn't debit an inventory that doesn't exist. |
| Voting + concentration failure | Not started | Most fun to design, least load-bearing before there are players. |
| Threats and defence | Not started | Era II. Don't build the dragon before the bee works. |
| Sectors / adjacency | Cut from MVP | Right idea, real scope. Adjacency is also a gas trap — cap it at the sector boundary or settlement becomes a graph traversal. |
| Adoption merge + yield split | Partial | `adopt()` sets a steward; the merge is `TODO`. |

Each stub in the code carries a `TODO(area):` tag with the reason attached
rather than a bare `TODO`.
