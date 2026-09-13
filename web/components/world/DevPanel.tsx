"use client";

import { useState } from "react";
import { STARTING_SPECIES } from "../../lib/world/plants";
import type { Garden } from "../../lib/world/useGarden";

/**
 * TEST HARNESS. Not a game feature.
 *
 * Epochs are 24 hours on a real chain, which makes every rule in this build
 * untestable by playing. So: skip time, force the outcome, and hand yourself
 * resources.
 *
 * Everything here CHEATS, and it is labelled that way on purpose. The reveal
 * toggle in particular breaks the one rule the whole design rests on -- that
 * the requirement is unknown while you are drawing -- so it must never be
 * reachable in a build anyone plays.
 *
 * TODO(ship): gate on NEXT_PUBLIC_DEV_TOOLS, or delete this file.
 */
export function DevPanel({ garden }: { garden: Garden }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(5);

  if (!open) {
    return (
      <button className="ig-dev-open" onClick={() => setOpen(true)} title="Test harness">
        ⏱ test
      </button>
    );
  }

  const skipMany = (good: boolean) => {
    // Sequential, not a loop over settle(): each epoch has to see the state
    // the last one produced, and React will not have re-rendered inside a
    // synchronous loop.
    let i = 0;
    const one = () => {
      if (i++ >= n) return;
      good ? garden.skipGood() : garden.skipBad();
      window.setTimeout(one, 60);
    };
    one();
  };

  return (
    <div className="ig-dev">
      <div className="ig-dev-head">
        <span className="ig-label">Test harness · everything here cheats</span>
        <button onClick={() => setOpen(false)}>×</button>
      </div>

      <p className="ig-hud-fine">
        Epochs are 24h on-chain. Nothing in this build is testable by waiting.
      </p>

      <div className="ig-dev-grid">
        <button onClick={() => garden.skipGood()}>Skip epoch · watered</button>
        <button onClick={() => garden.skipBad()}>Skip epoch · droughted</button>
      </div>

      <label className="ig-dev-row">
        <span>Skip ×</span>
        <input type="number" min={1} max={40} value={n}
          onChange={(e) => setN(Math.max(1, Math.min(40, +e.target.value || 1)))} />
        <button onClick={() => skipMany(true)}>watered</button>
        <button onClick={() => skipMany(false)}>droughted</button>
      </label>

      <div className="ig-dev-grid">
        <button onClick={() => garden.grantDust(50)}>+50 dust</button>
        <button onClick={() => garden.grantDust(500)}>+500 dust</button>
      </div>
      <div className="ig-dev-grid">
        {garden.species.map((sp) => (
          <button key={sp.id} onClick={() => garden.grantSeed(sp.id)}>
            +1 {sp.name}
          </button>
        ))}
      </div>

      <label className="ig-dev-check">
        <input type="checkbox" checked={garden.peek}
          onChange={(e) => garden.setPeek(e.target.checked)} />
        <span>
          Reveal the roll <small>breaks the core rule — testing only</small>
        </span>
      </label>

      <button className="ig-dev-danger" onClick={() => {
        garden.resetAll(); garden.setActiveSeed(STARTING_SPECIES);
      }}>
        Reset to a fresh farmer
      </button>
    </div>
  );
}
