# Open questions

The honest list. Nothing here is hidden in a comment somewhere hoping nobody
notices.

---

## Tuning — can only be settled by playing

**How wide is the band, and how fast does it move?**
The single most important unsolved problem in the game. Too wide and there's no
tension; too narrow and every level times out. It is a function of
`Well.refillPerEpoch`, `REQ_MAX − REQ_MIN`, and player count together, and no
amount of reasoning substitutes for watching real people play one season.

**The hazard curve's shape.**
Too shallow and collapse feels arbitrary and unearned; too steep and it's a
threshold with extra steps, which is the thing the hazard model exists to
avoid. Currently a linear ramp on well level alone.

**How the odds get surfaced.**
Players need *dread*, not confusion. A percentage is honest but reads like a
spreadsheet. The state of the world — which creatures are still around — reads
better but hides information. Probably both, with the number available and the
creatures leading.

---

## Design — decided provisionally, worth revisiting

**Does stagnation fail as a timeout or as its own collapse?**
Currently a timeout: the level expires undone, nothing dies, nothing heals.
Leaning that way because it *feels* different from a depletion collapse and
should. But it means a stagnant world just... stops, which may be
anticlimactic.

**Should sectors be chosen or assigned?**
Chosen lets friends cluster, which helps coordination and hurts the mixing that
makes strangers cooperate. Cut from MVP entirely, so undecided.

**Creature attraction formula.**
How local, sector and world conditions combine — and whether mythicals should
be deterministic given conditions, or a roll on top. Deterministic makes them
an achievement; a roll makes them an event.

**Sponsorship cap.**
Uncapped, a wealthy player sponsors a hundred newcomers who are all really
them, and the funded-wallet barrier evaporates.

**How contribution maps to collectible tiers** within T1–T3.

---

## Known holes

**Voting bloc detection.**
HHI catches concentration across accounts but is blind to a cartel of ten
genuine players who always vote together. Measuring vote *correlation* across
epochs rather than holdings would catch it. v2, but know it's there before
someone finds it.

**Sharing randomness is weak.**
Resource sharing is meant to have variance — you commit to share and the amount
is rolled, so generosity carries risk. Implemented naively it would derive from
an already-public word, so a determined player could compute the outcome and
share optimally, which defeats the mechanic. Proper fix is commit-reveal or a
per-share VRF request. Currently **not implemented at all** rather than
implemented badly.

**Adjacency is a gas trap.**
If a plot's yield depends on neighbours whose yield depends on *theirs*,
settlement becomes a graph traversal over the whole world. The mitigation is to
cap adjacency at the sector boundary — a bounded loop over 6–8 plots, computed
once per sector per epoch and cached. Not built, but don't build it any other
way.

**Deploy circularity.**
`ChainlinkVRFSource` needs the Garden's address and the Garden needs the
source's. Either make `randomness` settable-once on Garden, or use CREATE2 to
precompute. `Deploy.s.sol` currently reverts on the non-mock path rather than
pretending.

**`setArt()` is an owner power.**
An address that can rewrite everyone's token art is a centralisation smell in a
game about centralisation. Put it behind the community vote or renounce it
before mainnet.

---

## Deferred by choice

| Thing | Why it waits |
|---|---|
| Challenge loop (gold, jewels, seeds, rare items) | Seeds are unmetered today — `contributeSeeds` doesn't debit an inventory that doesn't exist |
| Voting + concentration failure | Most fun to design, least load-bearing before there are players |
| Threats and defence | Era II. Don't build the dragon before the bee works |
| Sectors and adjacency | Right idea, real scope, and the water dilemma doesn't need it |
| Adoption merge and yield split | `adopt()` sets a steward; the merge is a stub |

---

## Not a question, but don't forget

**The name.** Don't ship as "Infinite Garden" — the metaphor is James Carse's
by way of the Ethereum Foundation, and there is already a memecoin trading on
it. Being mistaken for that is worse than any legal exposure. See
`DESIGN.md` §17.
