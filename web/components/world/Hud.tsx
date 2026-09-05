"use client";

import { useState } from "react";
import { DrawLedger } from "../DrawLedger";
import { HEALTH_MAX, REQ_MAX, REQ_MIN, WELL_CAPACITY, bandFor, forborne } from "../../lib/world/mechanics";
import type { Garden } from "../../lib/world/useGarden";

const BAND_LABEL: Record<string, string> = {
  thriving: "thriving", steady: "steady", stressed: "stressed", dying: "dying",
};

/**
 * The HUD's job is to make the dilemma visible without explaining it.
 *
 * So FORBORNE is the number in the largest type, not health and not the well.
 * Drawing REQ_MAX guarantees you meet whatever gets rolled, so everything you
 * did not draw up to that ceiling is restraint you chose and could have not
 * chosen. docs/DESIGN.md is explicit that this is the headline figure and the
 * ledger's left-hand column; the HUD should agree with the ledger.
 */
export function Hud({ garden }: { garden: Garden }) {
  const [open, setOpen] = useState(false);
  const band = bandFor(garden.mine.water);
  const wellPct = Math.round((garden.well / WELL_CAPACITY) * 100);
  const left = forborne(garden.drawn);

  return (
    <aside className="ig-hud">
      <div className="ig-hud-row">
        <div className="ig-stat">
          <p className="ig-label">Epoch</p>
          <p className="ig-stat-v ig-mono">{garden.epoch}</p>
        </div>
        <div className="ig-stat">
          <p className="ig-label">Your plot</p>
          <p className="ig-stat-v" data-band={band}>{BAND_LABEL[band]}</p>
          <div className="ig-bar"><i style={{ width: `${(garden.mine.water / HEALTH_MAX) * 100}%` }} /></div>
        </div>
      </div>

      <div className="ig-stat">
        <p className="ig-label">The well · shared</p>
        <p className="ig-stat-v ig-mono">{Math.round(garden.well).toLocaleString()} <small>/ {WELL_CAPACITY.toLocaleString()}</small></p>
        <div className="ig-bar ig-bar-well"><i style={{ width: `${wellPct}%` }} /></div>
      </div>

      <div className="ig-forborne">
        <p className="ig-label">Left in the well</p>
        <p className="ig-forborne-v ig-mono">{left}</p>
        <p className="ig-forborne-note">
          You have drawn <b className="ig-mono">{garden.drawn}</b>. This epoch needs
          somewhere between <b className="ig-mono">{REQ_MIN}</b> and <b className="ig-mono">{REQ_MAX}</b>,
          and nobody finds out which until every draw is locked. Taking {REQ_MAX} is
          the only certainty available — and it is the reason the well empties.
        </p>
      </div>

      {garden.cistern > 0 && (
        <div className="ig-stat">
          <p className="ig-label">Cistern · not from the well</p>
          <p className="ig-stat-v ig-mono">{garden.cistern}</p>
        </div>
      )}

      <button className="ig-btn" onClick={garden.settle}>
        Settle epoch {garden.epoch}
      </button>
      <p className="ig-hud-fine">
        On-chain this is two calls and nothing happens until somebody rolls the
        dice — see README. Locally it does both.
      </p>

      {garden.log.length > 0 && (
        <ol className="ig-log">
          {garden.log.map((s) => (
            <li key={s.epoch} className={s.met ? "" : "missed"}>
              <span className="ig-mono">e{s.epoch}</span>
              <span>needed {s.requirement}, you drew {s.drawn}</span>
              <b>{s.met ? "met" : "missed"}</b>
            </li>
          ))}
        </ol>
      )}

      <button className="ig-btn ig-btn-quiet" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"} the draw ledger
      </button>
      {open && (
        <div className="ig-hud-ledger">
          <DrawLedger epoch={garden.epoch} />
        </div>
      )}
    </aside>
  );
}
