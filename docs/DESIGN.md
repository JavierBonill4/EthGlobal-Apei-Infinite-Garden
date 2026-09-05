# Design

*v0.3 — merges the v0.2 design doc with the architecture flowchart.*

A shared world that everyone tends and anyone can ruin. You never win it. You
continue it, for as long as the community can hold the line.

---

## 01 — Design pillars

Fixed. Where a mechanic conflicts with one of these, **the mechanic changes.**

| | |
|---|---|
| **P1** | **No player can win alone.** No personal progression ladder, no accumulating power, no path a clever individual can optimise toward victory. |
| **P2** | **Standing buys trust, not power.** A good reputation confers no mechanical advantage. Its only value is that other players choose to work with you. |
| **P3** | **Nobody knows where the line is.** Players can watch conditions worsen. They cannot know which epoch breaks it. |
| **P4** | **Failure is designed, not accidental.** The world will collapse many times. The design's job is to make collapse meaningful, survivable, and worth returning from. |
| **P5** | **Greed is rational.** The selfish choice must genuinely pay. A dilemma where cooperation is obviously correct is not a dilemma. |
| **P6** | **Both extremes fail.** Taking too much kills the world. Taking too little stalls it. The community's job is to find and hold a band nobody has published. |

---

## 02 — The corridor

```
        collective caution pulls ◀──┼──▶ private incentive pushes
                                    │
   ┌────────────────┬───────?───────┴────────────┬───?───┬──────────────┐
   │   STAGNATION   │          THE BAND          │       │  DEPLETION   │
   └────────────────┴────────────────────────────┴───────┴──────────────┘
    plots stall           tiers unlock, rare          stress rises,
    tiers stay locked     creatures arrive            collapse rolled
    the level times out   the world advances          every epoch
```

Both directions lead to a failure, the safe middle is narrow, and **the two
boundaries are never published.** Players infer where they are from the state
of the world, and they are often wrong.

This is why the game is not a morality play. Restraint is not automatically
virtuous, and *someone has to be willing to push toward the right-hand edge or
nothing ever grows.*

### The band is emergent, not authored

The corridor is not a hand-tuned range in a config file. It falls out of one
mechanic:

> Each epoch, every plot must have received at least **x** water to stay
> healthy. **x** is rolled from a **public range**, but only **after every
> draw for that epoch is locked.**

Draw too little and you may miss `x`. Draw defensively — as everyone will —
and the well empties and *everyone* misses `x`. The failure this produces is
**precautionary hoarding**, the bank-run shape, which is a real and documented
commons failure and a much better villain than a calculating optimiser.

---

## 03 — The three resources

Deliberately not three variations on one mechanic.

| Resource | Axis | Shape |
|---|---|---|
| **Water** | Sustaining | One-sided commons. More for you is less for everyone. A floor only. |
| **Nutrients** | Growth | Two-sided. Too little stalls the world; too much depletes it. A floor **and** a ceiling. |
| **Creatures** | Emergent | Not extracted — attracted. Rivalrous by location, so competition without depletion. |

### Water: diminishing returns, full cost

The plot is credited on a curve that flattens to zero marginal benefit. **The
well is debited the full amount regardless.** Past the hard cap you are burning
the commons for literally nothing.

This makes calculated greed self-limiting, which is the point: the destructive
player is not someone optimising, it's someone panicking.

### Nutrients: the farm, and the coordination threshold

Nutrients are **bought from a communal farm**, and players feed the farm with
seeds won from challenges. So the commons here is the farm's *production
capacity*, not raw soil — which puts the public-goods loop at the centre rather
than running parallel to it.

Every seed carries a fork:

- **Keep it** — improve your own plot now, certainly.
- **Give it to the farm** — improve everyone's nutrient supply, *maybe*.

And the crucial rule from the architecture doc: *adding plants to the farm is
useless if there's not enough work behind it.* Contributions below a threshold
in a single epoch produce **nothing at all**.

That discontinuity turns the farm from a public-goods game into a
**coordination game**. Contributing is only rational if you believe others will
too — which is what forces players to actually talk to each other. Do not
soften it into a linear payout to make it feel fairer.

### Creatures: what you cannot take

You cannot draw a bee. You can only make a place worth visiting, and then
compete for the visit — a creature is in one plot at a time.

| Class | Requires |
|---|---|
| Common | Local: what you planted |
| Uncommon | Neighbourhood: adjacency and biodiversity |
| Rare | World: sustained conditions over many epochs |
| Mythical | World **and** neighbourhood **and** one specific local planting |

**Creatures are the dashboard.** Nobody should read that stress is at 0.71.
They should notice the herons have gone. That is far better feedback than a
meter and it fits P3 exactly: you can see things worsening and still not know
how close the line is.

---

## 04 — Joining, and the season cohort

Players stake in and wait in a queue. When the kickoff timer expires, everyone
in the queue starts **together**.

Cohort entry rather than rolling entry, deliberately: a shared season with a
clear start is what makes *"we reached level 4 together"* mean anything, and
rolling joins mean people arrive mid-collapse with no context for what they're
looking at.

Latecomers enter by **claiming wilderness** — a plot that reverted because
somebody left. That doubles as the stewardship mechanic: joining late means
inheriting somebody's abandoned mess, which is thematically exact.

### Area tracks work, not signups

```
worldArea = f(tendedPlots over trailing 3 epochs)
```

If area ratcheted up with every signup while the labour to tend it fluctuated,
collapse would stop being emergent and become arithmetic on a timer — and
anyone could kill the world by minting a swarm and walking away.

A plot untended for `K` epochs **reverts to wilderness**: it leaves the area
and its decay burden leaves with it. The world contracts when the community
shrinks, which is survivable and thematically right. An abandoned garden
becomes a field, not a ruin.

### Rules scale with population

Bands at 1–10, 11–100, 101–1,000, 1,001+ change *thresholds* — never the
resource curves. Express every threshold as a proportion of active plots, so
one set of tuning works at forty players and at four thousand.

---

## 05 — Logging off

A player leaving can set a standing instruction:

- **Work your plot** — your own water and nutrient levels decay more slowly.
- **Work the farm** — you add labour to communal nutrient production, capped by
  the seeds actually present.

This is a good solve for the inactive-player problem: absence becomes a *choice
with a cost* instead of pure damage.

**But it expires.** After a grace window, normal decay resumes. Logging off
well-prepared buys you a week, not immortality — otherwise abandonment stops
being one of the three failure modes the game is about.

---

## 06 — Collectibles

Minted as you go, soulbound and frozen until a level completes.

### The decoupling

> **The collectible records what you grew. The standing record records how you
> behaved.** Two separate objects, deliberately.

A magnificent orchid is a magnificent orchid. A patient player and a reckless
one can both grow one, at different speeds and carrying different risk, so the
object itself is honestly ambiguous about method.

What is **not** achievable is hiding the history outright. On-chain data is
permanent and indexed; metadata that stops displaying something doesn't remove
the information, and anyone can reconstruct the full mint history in an
afternoon. Shielded state could genuinely hide it, but that means private game
state from the start — a different project. Decoupling gets most of what was
wanted, honestly, at no cost.

### Two routes to a trophy

| Tier | Source | Character |
|---|---|---|
| T1–T3 | Your own plot's quality and history | Certain, private, achievable by extraction |
| T4–T5 | Garden tier features — the orchard, the pollinators, the ancient tree | Uncertain, collective, impossible without restraint |

The rarest items aren't distributed by a rule, they're **gated by a state the
world can only reach collectively**. Greed doesn't merely risk them, it makes
them unmintable. So the real choice is: defect and reliably get a T3, or
cooperate and *maybe* get a T5. Certainty against magnitude.

### Scars mark the era, not the player

When a season collapses, every collectible minted during it is marked. Not as
punishment — as **provenance**. The whole cohort carries the failure it was part
of, which fits P1 far better than singling individuals out, and avoids defacing
one player's property over a collective outcome.

*(This reverses an earlier draft. Under the corridor model the "greedy" player
may well have been the one who kept the world moving — so the deterrent moved
to the standing record and social enforcement, where it belongs.)*

**The next completion heals every scar.** And a healed scar should be **rarer
and more valuable than no scar at all**, because carrying one means the holder
survived a collapse *and* stayed through to a completion. That rewards
precisely the behaviour nothing else in the game can incentivise: coming back
after losing.

### The unlock

On completion every collectible unlocks at once — soulbound becomes
transferable. Everyone present benefits, because that is what a public good is.
What you hold depends on what you grew; nobody is excluded, and a better haul
confers no advantage in play.

> **Rewards can be unequal. Powers cannot.**

---

## 07 — Standing

One soulbound token per player. Never transferable, **never revoked**, but
mutable — the art redraws as the record changes.

Water left against water taken. Seeds given. Epochs present. Plots tended that
weren't yours. Where you stood at each collapse.

**A record, not a score.** A single number invites leaderboard optimisation,
which is the individual-progression trap P1 rules out. A multi-dimensional
record invites *judgement* instead, and there's nothing to game because there's
no target.

It must also stay **honestly ambiguous**. Under the corridor model a heavy draw
is not evidence of anything on its own — it may be the reason a tier unlocked.
The record shows what happened and lets players argue about what it meant. It
never adjudicates.

Standing has no mechanical power: no better soil, no larger plot, no earlier
access. Its entire value flows through other players' choices — who you cede to,
who you delegate to, who you coordinate planting with, who you sponsor in.

**Weight it toward recent behaviour**, or you've built the eBay feedback
attack: farm a clean history cheaply, then spend it on one large betrayal at
the moment it hurts most.

---

## 08 — Sharing

Sharing resources is optional, and the amount is **random within a public
range**. You choose to be generous; you don't get to be precisely generous.

That makes generosity a genuine risk rather than a calculated transfer, and it
stops players optimising their altruism to the decimal. Keep the range public
and skewed favourably — variance should feel like generosity, not regret.

---

## 09 — Two shapes of failure

### Depletion — a roll

There is no threshold. There is a **rising hazard rate**: stress accumulates,
collapse probability is a public function of stress, and the roll happens at
settlement.

This beats a hidden constant three ways. It removes the "the devs rigged it"
attack surface entirely. It produces **near misses**, which is where the
stories come from. And it's the more truthful model — ecosystems don't have
crisp breaking points, they get fragile and then something tips them.

> **Hide the roll, not the rules.** On a public chain you cannot have a secret:
> storage is readable even when marked private. Assume that within a day of
> launch someone publishes a dashboard of exactly how close the world is to
> breaking — and design so that this doesn't matter.

A collapse knocks the world down one tier and kills the **least-tended plots
first**, so damage correlates with neglect rather than falling at random. That
answers "why invest if strangers can destroy it" without any progression ladder
— and a surviving plot in a collapsed world is still a sad square of dirt, so
you still can't save yourself alone.

### Stagnation — a timeout

The level expires undone. Nothing dies, nothing heals, collectibles stay
locked. Quieter and sadder than a collapse, and a genuinely different thing to
have to explain to your community afterwards.

---

## 10 — Levels and continuing play

A level completes when the world reaches a state no single strategy can
produce — area, sustained tended-ratio, well floor held, nutrient floor met,
tier features unlocked, **all at once, for N consecutive epochs.**

Duration is the only requirement that cannot be bought, and it's what makes a
collapse at epoch N−1 devastating.

Three horizons, because players must win something in week one or they won't be
there in week ten: **epoch goals** (days), **tier goals** (weeks), **level
goal** (the finale).

### The endgame is policed socially

Near completion the community will want to stop a handful of players from
breaking a nearly-finished level. That pressure is deliberately left to the
players: no quarantine mechanic, no removal power. They argue, they shame, they
negotiate, and sometimes they fail.

This is where "the community splits" stops being a stated failure mode and
becomes a lived one — and it's where the corridor bites hardest, because the
players everyone suspects may be the ones holding the tier open.

### The permanent scoreboard

Completion starts the next level: larger world, tighter band, higher bar. There
is no victory condition for the game itself, only levels that continue.

The permanent scoreboard is not any player's holdings. It is the high-water
mark. *We reached Era III in season two.*

---

## 11 — The roadmap

From the architecture doc, and better than the monster-based version it
replaces:

| Stage | Adds | The failure it explores |
|---|---|---|
| **Simple Collaborative Garden** | Plots, water, nutrients, creatures | The commons itself |
| **Governance Garden** | Voting, delegation, collective choice | Coordination and apathy |
| **The Centralised Garden** | Vote concentration, permissioning, KYC gates, central authorities | Capture |

The third stage is the sharp one: *the garden gets a government, and the
government becomes the new failure mode.* That's a pointed statement about
Ethereum's own politics and it lands far harder than a dragon.

Its central trap, worth building toward: **voting power comes from work, so the
players keeping the world alive are the ones pushing it toward the
concentration failure.** There is no villain — the failure mode is generated by
virtue. The only remedy is that the hardest workers voluntarily give power up.

---

## 12 — Entry, exit and Sybil

Joining escrows a small refundable stake. One primitive, three jobs: a Sybil
toll, an exit incentive, and the funding for stewardship.

| Exit | Stake |
|---|---|
| Cede cleanly to a named player | Refunded |
| Complete or collapse, having tended | Refunded |
| Go dormant until wilderness | Forfeited to the Stewardship Pool |

**Why most Sybil attacks aren't attacks here:** every right attaches to a
*tended plot*, not to an address — water, nutrients, voting weight, collectible
eligibility. An attacker who wants any of those must actually tend a thousand
plots, at which point they're playing the game very enthusiastically.

The residual risk is the **level-completion headcount**, which is the number
worth attacking. That's where proof of personhood goes — and nowhere else,
because friction at the front door fights the win condition.

**The tension to hold in view:** the stake fights acquisition. The amount is
trivial; requiring a funded wallet at all is not. Sponsorship (an existing
player stakes a newcomer in) is both the fix and the most concrete use of
standing in the game — vouching for a stranger with your own money is costly,
verifiable, and confers no power. Cap it, or one wealthy player sponsors a
hundred newcomers who are all really them.

---

## 13 — Stewardship

Maintaining other people's plots is the central community act, and framing it
as an obligation guarantees nobody does it. Make it profitable and risky
instead.

- `adopt(plotId)` — pays you its yield while you tend it, charges you its decay
  if you slip. After three consecutive tended epochs it merges into your
  holding.
- `cede(plotId, to)` — hand your plot to a specific player. Stake refunds, and
  your record shows a clean exit rather than an abandonment.

The Stewardship Pool, funded by forfeited stakes, pays adoption bounties and
the settlement bounty. The people who created the burden fund the work of
absorbing it.

---

## 14 — Technical spine

**L2, not mainnet.** The game asks each player for a transaction a day. On
mainnet that's dollars per tend and the stake gets swallowed by a single
transaction. This is settled practice, not a compromise — essentially every
fully on-chain game lives on an L2 or an app-chain.

**Epochs and lazy decay.** Fixed 24-hour epochs, never per block. Health is
derived on read from `lastTendedEpoch`, so an idle plot costs nothing until
someone touches it. One permissionless `settleEpoch()` with a bounty so it
always gets called.

**The constraint, from day one:** every mechanic must be expressible as *state
at epoch N derived from actions during epoch N−1*. Anything that can't be gets
cut.

See `ARCHITECTURE.md` for the settlement dance, the histogram trick, and why
the randomness is VRF rather than `prevrandao`.

---

## 15 — What was cut, and why

| Cut | Reason |
|---|---|
| **"Top gardens rewarded"** | A leaderboard, which violates P1. Completion rewards everyone who qualified; what differs is what you *grew*, not your rank. |
| **Rolling joins** | Conflicted with the cohort model. Kept only as wilderness claims, which doubles as stewardship. |
| **Sectors / adjacency** | Right idea, real scope, and the water dilemma doesn't need it. Also a gas trap — see `OPEN-QUESTIONS.md`. |
| **Dragons and monsters** | Replaced by the governance roadmap, which is sharper and more on-theme. |
| **Confiscating collectibles** | A collectible the issuer can take back is a scoreboard row with a gas bill. Scarring and healing does the same emotional work honestly. |
| **Veteran abilities** | A personal power ladder, violating P1 and P2. If threats return: abilities belong to *the world*, and defensive roles are **taken, not earned** — the scarcity is willingness to give up a turn, not accumulated stats. |

---

## 16 — Ostrom mapping

Elinor Ostrom won a Nobel for documenting how real communities govern shared
resources without collapsing. Her eight principles are close to a spec for this
game — naming them shows the mechanics came from somewhere.

| Principle | In the world |
|---|---|
| Clear boundaries | Plot stake and wilderness reversion — membership is observable |
| Rules fit conditions | Proportional thresholds; a band that moves with era and population |
| Collective choice | The per-epoch Expansion vs. Resilience vote |
| Monitoring | The public draw ledger, led by **forbearance**; creatures as ambient signal |
| Graduated sanctions | Tier knock-down, neglect-weighted plot death, era-scarred collectibles |
| Conflict resolution | Quorum rules, cede/adopt handoff |
| Right to organise | Sacrifice pledges, delegation, water compacts |
| Nested enterprises | Plot in world; epoch in tier in level in era |

---

## 17 — Naming and IP

**Don't ship as "Infinite Garden."**

Copyright is the wrong frame — short phrases and names aren't copyrightable, so
this is a trademark question, and a light one. The Ethereum Foundation's page
on the metaphor carries no trademark notice, no licensing statement and no
usage guidance; it reads as a philosophical position rather than a branded
property. And the idea isn't theirs to begin with — it comes from **James P.
Carse's *Finite and Infinite Games***, which the EF applied to Ethereum.

**The real risk isn't the Foundation.** There is already at least one memecoin
trading on the name. Being mistaken for it is worse for a serious project than
any legal exposure, and no amount of explaining fixes a first impression.

Take your own name and credit the metaphor and Carse openly in the README and
the pitch. You keep the resonance, lose the confusion, and get something
searchable.

> **Worth stealing from Carse:** a finite game is played to win and then it
> ends; an infinite game is played to continue play. This design already sits
> on the right side of that line — there is no victory, only levels that
> continue. So say it in the game's own language: **you never win, you
> continue.** It also explains why the permanent scoreboard is the high-water
> mark rather than anyone's holdings, and gives collapse its meaning: a finite
> game would be over, an infinite one starts again.

*Not legal advice. If this becomes a product with a token attached, get a real
opinion.*

---

## References

- ERC-5192: Minimal Soulbound NFTs — <https://eips.ethereum.org/EIPS/eip-5192>
- *Nurturing the Infinite Garden*, Ethereum Foundation — <https://ethereum.foundation/infinitegarden>
- Elinor Ostrom, *Governing the Commons* (1990)
- James P. Carse, *Finite and Infinite Games* (1986)
