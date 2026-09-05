# The Garden

An on-chain commons experiment shaped like a gardening game.

Everyone tends one plot in one shared world. Every epoch, each plot needs some
amount of water to stay healthy — and **you don't find out how much until
after everyone has drawn.** Draw too little and your plot suffers. Draw
defensively, like everyone else does, and the well empties and the whole world
suffers. The world will collapse. That is not a bug, it is the subject.

You never win it. You continue it, for as long as the community can hold the
line.

> **Working title.** Do not ship as "Infinite Garden" — see
> [`docs/DESIGN.md` §17](docs/DESIGN.md#17--naming-and-ip) for why (short
> version: the metaphor is James Carse's by way of the Ethereum Foundation, and
> there is already a memecoin on the name).

---

## Why this is interesting

Most cooperative games make cooperation obviously correct, which makes them
morality plays. This one doesn't:

- **Greed genuinely pays.** A bigger draw grows your plot. It has to, or there
  is no dilemma.
- **But it stops paying.** The credit curve flattens to zero while the well
  is always debited face value. Past a point you are burning the commons for
  nothing — so the destructive player isn't a calculating optimiser, it's
  someone panicking about an unknown requirement.
- **Restraint isn't automatically virtuous either.** Take too little as a
  community and the world stagnates, the level times out, and nothing unlocks.
  Somebody has to be willing to push. That person looks identical to a
  reckless extractor in the ledger, and nobody can tell which they were.
- **Nothing is hidden except the roll.** Every threshold, range and formula is
  public and auditable on-chain. Only the dice are unknown, and only until
  settlement. No secret constants, no "the devs rigged it".

The mechanics are Elinor Ostrom's design principles for governing commons,
turned into game rules. That's a citation, not a decoration —
[`docs/DESIGN.md` §16](docs/DESIGN.md) maps each one.

---

## Repo layout

```
contracts/     Foundry. The world lives here.
  src/
    Garden.sol           core state, epochs, the settlement roll
    Well.sol             shared water
    Farm.sol             communal nutrients + the coordination threshold
    StandingRecord.sol   soulbound, mutable, never revoked
    Collectibles.sol     soulbound until a level completes
    art/                 IPlotArt -- the on-chain art swap point
subgraph/      The Graph. The draw ledger is a subgraph.
web/           Next.js. Reads the subgraph, writes to the contracts.
art/           ALL VISUAL ASSETS + the designer handoff spec. Start at ART.md.
docs/          Design, architecture, mechanics, integrations, open questions.
```

## Environment files

There are **two**, in two places, because Foundry and Next.js each look in
their own directory. A single `.env` at the repo root is read by neither.

| File | Read by | Copy from |
|---|---|---|
| `contracts/.env` | `forge` | `contracts/.env.example` |
| `web/.env.local` | `next` | `web/.env.local.example` |

The root `.env.example` is an annotated master list — useful for seeing every
variable in one place, but it is reference, not config.

**Everything to do with Chainlink, The Graph, World, ENS and Privy can stay
empty while you build locally.** The examples ship with working localhost
values; the only ones that matter on day one are `PRIVATE_KEY`,
`USE_MOCK_RANDOMNESS=true`, and `NEXT_PUBLIC_CHAIN_ID=31337`.

## Local first run

```bash
git clone <your-repo> && cd infinite-garden

# 1. contracts
cd contracts
cp .env.example .env
forge install foundry-rs/forge-std
forge build && forge test -vvv

# 2. a local chain
anvil                                    # leave running in another terminal

# 3. deploy a season
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# copy Garden + MockRandomness addresses from the output into contracts/.env
# (GARDEN_ADDRESS, RNG_ADDRESS) and into web/.env.local

# 4. the season starts after the kickoff timer, so jump the clock
cast rpc evm_increaseTime 172800 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
cast send $GARDEN_ADDRESS "startSeason()" --rpc-url http://127.0.0.1:8545 --private-key $PRIVATE_KEY

# 5. web
cd ../web && cp .env.local.example .env.local && npm install && npm run dev
```

### The one thing that will confuse you

Settlement is **two-phase on purpose**: `settleBegin()` requests a random word,
and a callback finalises the epoch. On a real network Chainlink delivers that
callback. Locally, `MockRandomness` delivers nothing until somebody calls
`fulfil()`.

So if you call `settleBegin()` and nothing happens — and then every later
settlement reverts with `SettlementInFlight` — the contract is not broken.
**Nobody rolled the dice.** Use the helper, which does both halves:

```bash
cd contracts
cast rpc evm_increaseTime 86400 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
forge script script/LocalSettle.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

It prints the requirement that was rolled and the well level, which is the
fastest way to feel whether your parameters are tuned sanely.

### Two more local gotchas

- **Epochs are 24 hours.** Nothing settles until the clock moves. Every local
  session is mostly `evm_increaseTime`.
- **`MockRandomness` lets anyone choose the roll.** That is the point locally
  and a catastrophe anywhere else — it hands the world's fate to whoever calls
  settlement. `USE_MOCK_RANDOMNESS` must never be true on a public network.

`forge install` is the only step needing network access beyond npm.

## Where to start reading

| If you want to... | Read |
|---|---|
| Understand the game | [`docs/DESIGN.md`](docs/DESIGN.md) |
| Understand the code | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Tune the numbers | [`docs/MECHANICS.md`](docs/MECHANICS.md) |
| Wire a sponsor SDK | [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) |
| Make the art | [`art/ART.md`](art/ART.md) |
| Know what's unsolved | [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md) |

## Status

Early scaffold. The core loop compiles and the epoch/settlement machinery is
real; the challenge loop, voting, and threats are stubs marked `TODO(...)` with
the reason attached. `docs/OPEN-QUESTIONS.md` is the honest list of what is
still undecided — the band width is the biggest one and it can only be settled
by playing.

## Contributing

Two rules that matter more than style:

1. **Don't remove a dilemma to fix a "bug".** If a test named after a design
   property fails, read its comment before changing anything. Several of them
   are guarding asymmetries that look like mistakes.
2. **Every mechanic must fit `state at epoch N derived from actions during
   epoch N-1`.** If it can't be expressed that way, it doesn't go in.

## Licence

MIT — see [LICENSE](LICENSE).
