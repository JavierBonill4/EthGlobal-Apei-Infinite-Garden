# Integrations

Five sponsor SDKs, each solving a problem the design *already had*. The test
for whether an integration belongs: can you finish the sentence "we couldn't
build this without X" truthfully? If not, leave it out — judges can tell.

| Sponsor | The sentence | Cost to add | Where |
|---|---|---|---|
| **Chainlink** | The roll must be unmanipulable | Free — already required | `randomness/` |
| **The Graph** | The ledger *is* the product | Needed anyway | `subgraph/` |
| **World** | The completion headcount is farmable without it | Real days | `web/` + join path |
| **ENS** | The world is a hierarchy and needs names to match | Real days | `web/` + resolver |
| **Privy** | The stake barrier kills the acquisition the win condition depends on | Cheap | `web/` |

---

## Chainlink — VRF

**Status:** architecture in place (`IRandomnessSource`), coordinator call stubbed.

Rolls the per-epoch water requirement. Not a decoration — see
`ARCHITECTURE.md` for why `block.prevrandao` is actively unsafe here:
`settleBegin()` is permissionless, so a caller who could see the word first
would decline to settle epochs they disliked, handing one anonymous person
control over the world's fate.

```bash
forge install smartcontractkit/chainlink-brownie-contracts
```

Then in `src/randomness/ChainlinkVRFSource.sol`, extend `VRFConsumerBaseV2Plus`,
call `s_vrfCoordinator.requestRandomWords(...)` from `requestRandomness()`, and
forward from `fulfillRandomWords` into `_deliver()`. The `TODO(integration)`
block has the imports.

**Also worth wiring:** Chainlink Automation as a *fallback* caller for
`settleBegin()`. Don't replace the permissionless bounty with it — a world that
only advances when a keeper says so is a centralisation smell in a game about
centralisation.

## The Graph — subgraph

**Status:** schema written, mappings stubbed.

The draw ledger, the forbearance leaderboard, standing history, which
creatures were present when — none of it is readable from contract state at a
tolerable cost. You need this regardless of any prize.

> **Prize requirement:** the composability track wants **two or more Graph
> products**. A lone subgraph won't qualify — pair it with the Token API or
> Substreams.

The `WaterDrawn` event deliberately carries **`forborne`**, not just `amount`.
Water *left* is the headline number in the UI; if restraint is invisible,
holding back just makes you a sucker.

## World — proof of personhood

**Status:** not started.

The Selfie Check track asks for low-friction biometric credential flows
demonstrating abuse prevention. That is verbatim this game's largest
unresolved risk.

Gate personhood on the **level-completion active-player count specifically** —
that's the number worth attacking. Do *not* gate joining on it: the design
already makes ordinary Sybils pointless (rights attach to tended plots), and
adding friction at the front door fights the win condition.

## ENS — ENSv2

**Status:** not started.

The world is already a hierarchy, which is exactly what the ENSv2 track
rewards:

```
garden.eth                      the world
  sector-7.garden.eth           a neighbourhood
    javier.sector-7.garden.eth  a plot
```

- **Wildcard resolution** serves thousands of plot names from game state
  through one resolver, instead of registering each on-chain. This is what
  wildcard resolution is *for*.
- **Enhanced Access Control** maps onto `cede()` and `adopt()` — handing over
  stewardship of a plot genuinely *is* an access-control operation, not a
  metaphor for one.

Note ENSv2 is on a Sepolia beta. Plan how that coexists with wherever the game
itself deploys — most likely: game on Base Sepolia, names on ENS Sepolia,
joined in the frontend.

## Privy — embedded wallets

**Status:** not started.

`MECHANICS.md` names the problem: the stake is trivial as money, but requiring
a funded wallet at all cuts acquisition hard, and level completion needs
acquisition. Email/social login with a wallet created behind the scenes is the
fix for a sentence already written into the design.

Pairs with **sponsorship** (an existing player stakes a newcomer in): a
sponsored newcomer with an embedded wallet has almost no friction between
hearing about the game and holding a plot. Sponsorship needs a cap, or one
wealthy player sponsors a hundred newcomers who are all really them.

---

## Deliberately skipped

**Hedera** and **Arc** have the biggest pots and are the trap. Hedera isn't
Ethereum and its tracks want x402 agentic payments and enterprise asset
tokenisation; Arc is Circle's stablecoin L1 and wants DeFi pools and USDC agent
payments. Chasing either means deforming the game around a payment rail it
doesn't need.

**1inch** (DEX aggregation, Aqua apps) and **Uniswap** (AMM, v4 hooks) both
need trading this game doesn't have. **Ledger**'s specifics were still
forthcoming. **Bazantic** — no credible public information found; ask in the
event Discord rather than guessing.

## Sequencing

Chainlink is free. Privy is a cheap frontend swap. The Graph you'd pay for
anyway. **ENS and World are the two that cost real days and carry the highest
conceptual payoff** — so if something has to drop under time pressure, drop
Privy at the last minute rather than either of those.
