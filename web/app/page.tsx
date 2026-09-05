import { DrawLedger } from "../components/DrawLedger";
import { PlotTile } from "../components/art/ArtLayer";

/**
 * Scaffold home screen. Three things, in the order they matter:
 *   1. the well, because it is the shared thing
 *   2. the map, because creatures leaving is how you read the world's health
 *   3. the ledger, because it is the demo
 *
 * TODO(wiring): plot data is stubbed. Read it from the subgraph and the
 * contract, and get `epoch` from Garden.currentEpoch() rather than hardcoding.
 */

const STUB_PLOTS = [
  { id: 1, water: 820, nutrient: 640, creature: { cls: "common" as const, key: "bee" } },
  { id: 2, water: 510, nutrient: 380, creature: null },
  { id: 3, water: 240, nutrient: 300, creature: null },
  { id: 4, water: 90, nutrient: 120, creature: null },
  { id: 5, water: 700, nutrient: 720, creature: { cls: "rare" as const, key: "crane" } },
  { id: 6, water: 0, nutrient: 0, wilderness: true, creature: null },
];

export default function Home() {
  return (
    <main className="ig-wrap">
      <header style={{ marginBottom: "2rem" }}>
        <p className="ig-label">Season 1 · Simple Collaborative Garden</p>
        <h1 style={{ margin: "0.4rem 0", fontSize: "2.4rem", letterSpacing: "-0.02em" }}>
          The Garden
        </h1>
        <p style={{ color: "var(--ig-muted)", maxWidth: "34rem" }}>
          Everyone tends one plot in one shared world. Each epoch every plot
          needs some amount of water — and you find out how much only after
          everyone has drawn.
        </p>
      </header>

      <section className="ig-panel" style={{ marginBottom: "1.5rem" }}>
        <p className="ig-label">The well</p>
        {/* TODO(art): swap for ui/well-gauge.svg driven by real state. */}
        <p className="ig-mono">— / — units</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p className="ig-label" style={{ marginBottom: "0.6rem" }}>
          The world
        </p>
        <div className="ig-map">
          {STUB_PLOTS.map((p) => (
            <PlotTile
              key={p.id}
              size={80}
              waterHealth={p.water}
              nutrientHealth={p.nutrient}
              isWilderness={"wilderness" in p ? Boolean(p.wilderness) : false}
              creature={p.creature}
            />
          ))}
        </div>
      </section>

      <DrawLedger epoch={0} />
    </main>
  );
}
