# web

Next.js app. Reads the subgraph, writes to the contracts.

## Setup

```bash
npm install
mkdir -p public && ln -s ../../art public/art   # REQUIRED -- see next.config.mjs
npm run dev
```

## Where things are

| Path | What |
|---|---|
| `components/art/ArtLayer.tsx` | **The only file that knows where art lives.** Don't import an SVG anywhere else. |
| `components/DrawLedger.tsx` | The demo. Who drew what, who forbore. |
| `lib/queries.ts` | Subgraph queries |
| `lib/contracts.ts` | Addresses + ABI wiring |

Not wired yet: Privy (embedded wallets) and World ID (personhood on the
completion headcount). See `../docs/INTEGRATIONS.md`.
