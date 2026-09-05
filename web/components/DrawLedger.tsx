"use client";

/**
 * THE DEMO.
 *
 * A live, public, sorted list of who took what -- with the well falling
 * alongside it -- communicates the entire game in ten seconds without anyone
 * reading a rule. Build this early and well; it is worth more than any other
 * screen.
 *
 * The column order is a design decision, not a layout one: LEFT comes before
 * TAKEN. Everything on a public chain is visible anyway; the only question is
 * whether that visibility is an implementation detail or the product. It is
 * the product.
 */

import { useEffect, useState } from "react";
import { gql, DRAW_LEDGER, isIndexerConfigured, IndexerNotConfigured } from "../lib/queries";

type Draw = {
  id: string;
  amount: string;
  forborne: string;
  player: { id: string; ensName: string | null };
  plot: { id: string };
};

type EpochRecord = {
  epoch: number;
  requirement: number | null;
  wellLevel: number | null;
  plotsMet: number | null;
  plotsMissed: number | null;
  totalDrawn: string;
  totalForborne: string;
  settledAt: string | null;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DrawLedger({ epoch }: { epoch: number }) {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [record, setRecord] = useState<EpochRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isIndexerConfigured) return;
    let cancelled = false;
    gql<{ draws: Draw[]; epochRecord: EpochRecord | null }>(DRAW_LEDGER, { epoch })
      .then((d) => {
        if (cancelled) return;
        setDraws(d.draws);
        setRecord(d.epochRecord);
      })
      .catch((e) => {
        if (cancelled || e instanceof IndexerNotConfigured) return;
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [epoch]);

  // Running without a subgraph is the normal local-dev state, not a failure.
  // Everything else on the page works; this panel just has nothing to show.
  if (!isIndexerConfigured) {
    return (
      <section className="ig-panel">
        <p className="ig-label">Epoch {epoch} · draw ledger</p>
        <p style={{ color: "var(--ig-muted)" }}>
          Not indexed yet. Set <code>NEXT_PUBLIC_SUBGRAPH_URL</code> in{" "}
          <code>web/.env.local</code> to see who drew what.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <div className="ig-panel">
        <p className="ig-label">Ledger unavailable</p>
        <p>{error}</p>
      </div>
    );
  }

  const settled = record?.settledAt != null;

  return (
    <section className="ig-panel">
      <p className="ig-label">Epoch {epoch} · draw ledger</p>

      {/* The requirement is the whole tension. Until settlement it does not
          exist yet -- not "hidden", genuinely not yet rolled. Say so plainly,
          because "unknown" and "withheld" feel very different to a player. */}
      <p className="ig-mono">
        {settled
          ? `Required ${record?.requirement} · ${record?.plotsMet} met · ${record?.plotsMissed} missed`
          : "Requirement not yet rolled — it is drawn after this epoch closes"}
      </p>

      <table className="ig-ledger">
        <thead>
          <tr>
            <th>Player</th>
            <th>Plot</th>
            <th>Left</th>
            <th>Taken</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((d) => (
            <tr key={d.id}>
              <td className="ig-mono">{d.player.ensName ?? short(d.player.id)}</td>
              <td className="ig-mono">#{d.plot.id}</td>
              <td className="ig-mono ig-forborne">{d.forborne}</td>
              <td className="ig-mono">{d.amount}</td>
            </tr>
          ))}
          {draws.length === 0 && (
            <tr>
              <td colSpan={4}>Nobody has drawn yet this epoch.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
