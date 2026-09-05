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

## Quickstart

```bash
git clone <your-repo> && cd infinite-garden
cp .env.example .env          # then fill it in

# contracts
cd contracts
forge install foundry-rs/forge-std
forge build
forge test -vvv

# local season with a steerable dice roll
anvil &
USE_MOCK_RANDOMNESS=true forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 --broadcast

# web
cd ../web && npm install && npm run dev
```

`forge install` is the only step that needs network access beyond npm.

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
