"use client";

import { useState } from "react";
import { REQ_MAX, REQ_MIN, WELL_CAPACITY } from "../../lib/world/mechanics";
import {
  canHeal, dustAtNextStage, dustFor, speciesById, atMaxStage,
} from "../../lib/world/plants";
import type { Garden } from "../../lib/world/useGarden";

/**
 * The HUD leads with the thing you cannot know.
 *
 * You are asked to commit water before the requirement is rolled. Everything
 * else in this panel -- plants, dust, the commune bar -- is downstream of that
 * one decision, so it sits at the top in the largest type and everything else
 * is quieter.
 */
export function Hud({ garden }: { garden: Garden }) {
  const [tab, setTab] = useState<"patch" | "seeds" | "commune">("patch");
  const wellPct = Math.round((garden.well / WELL_CAPACITY) * 100);
  const communePct = Math.min(1, garden.communePool / garden.communeGoal);
  const incoming = garden.plants.reduce((a, p) => a + dustFor(p), 0);

  return (
    <aside className="ig-hud">
      {/* ---- the epoch ---- */}
      <div className="ig-hud-row">
        <div className="ig-stat">
          <p className="ig-label">Epoch</p>
          <p className="ig-stat-v ig-mono">{garden.epoch}</p>
        </div>
        <div className="ig-stat">
          <p className="ig-label">Ether dust</p>
          <p className="ig-stat-v ig-mono">{garden.dust}</p>
          <p className="ig-hud-fine">+{incoming} next settlement</p>
        </div>
      </div>

      <div className="ig-forborne">
        <p className="ig-label">Water drawn this epoch</p>
        <p className="ig-forborne-v ig-mono">{garden.drawn}</p>
        <p className="ig-forborne-note">
          Enough is somewhere between <b className="ig-mono">{REQ_MIN}</b> and{" "}
          <b className="ig-mono">{REQ_MAX}</b>, and nobody finds out which until
          every draw is locked. Fall short and every plant loses a point of
          health. Clear it and they grow.
          {garden.peek && (
            <em className="ig-peek"> · testing: it will be rolled at settlement</em>
          )}
        </p>
        <div className="ig-water-btns">
          <button className="ig-btn ig-btn-quiet" onClick={() => garden.water(10)}>+10</button>
          <button className="ig-btn ig-btn-quiet" onClick={() => garden.water(25)}>+25</button>
          <button className="ig-btn" onClick={() => garden.settle()}>
            Settle epoch {garden.epoch}
          </button>
        </div>
        <div className="ig-bar ig-bar-well" style={{ marginTop: ".55rem" }}>
          <i style={{ width: `${wellPct}%` }} />
        </div>
        <p className="ig-hud-fine">
          The well: {Math.round(garden.well).toLocaleString()} of{" "}
          {WELL_CAPACITY.toLocaleString()} — shared with everyone.
        </p>
      </div>

      {/* ---- tabs ---- */}
      <div className="ig-subtabs">
        {(["patch", "seeds", "commune"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "patch" ? `Patch (${garden.plants.length})` : t === "seeds" ? `Seeds (${garden.totalSeeds})` : "Commune"}
          </button>
        ))}
      </div>

      {tab === "patch" && (
        <div className="ig-panel-body">
          {garden.plants.length === 0 ? (
            <p className="ig-empty">
              Bare dirt. You joined with one seed — walk onto a tile of your
              patch and press <kbd>Space</kbd> to sow it.
            </p>
          ) : (
            <ul className="ig-plants">
              {garden.plants.map((p) => {
                const sp = speciesById(p.speciesId);
                const mendable = canHeal(p);
                return (
                  <li key={`${p.x},${p.y}`}>
                    <div className="ig-plant-head">
                      <b>{sp.name}</b>
                      <span className={`ig-rarity ig-rarity-${sp.rarity}`}>{sp.rarity}</span>
                    </div>
                    <div className="ig-pip-row ig-pip-row-hud">
                      {Array.from({ length: sp.maxHealth }, (_, i) => (
                        <i key={i} className={i < p.health ? "on" : ""} />
                      ))}
                      <span className="ig-hud-fine">
                        {p.health}/{sp.maxHealth} · stage {p.stage}/{sp.maxStage} · {dustFor(p)} dust
                      </span>
                    </div>
                    <div className="ig-intent">
                      <button
                        className={p.intent === "grow" ? "on" : ""}
                        onClick={() => garden.setIntent(p.x, p.y, "grow")}
                      >
                        Grow
                        <small>
                          {atMaxStage(p) ? "fully grown" : `→ ${dustAtNextStage(p)} dust`}
                        </small>
                      </button>
                      <button
                        className={p.intent === "heal" ? "on" : ""}
                        disabled={!mendable}
                        onClick={() => garden.setIntent(p.x, p.y, "heal")}
                      >
                        Heal
                        <small>
                          {!mendable
                            ? "unhurt"
                            : `${sp.epochsForHeal - p.healStreak} in a row → +1`}
                        </small>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "seeds" && (
        <div className="ig-panel-body">
          <p className="ig-hud-fine">
            Sowing uses the <b>selected</b> seed. Rarer plants pay more dust and
            are more fragile — that is the whole trade.
          </p>
          <ul className="ig-seeds">
            {garden.species.map((sp) => {
              const held = garden.seedCount(sp.id);
              return (
                <li key={sp.id} className={garden.activeSeed === sp.id ? "on" : ""}>
                  <button className="ig-seed-pick" onClick={() => garden.setActiveSeed(sp.id)}>
                    <b>{sp.name}</b>
                    <span className={`ig-rarity ig-rarity-${sp.rarity}`}>{sp.rarity}</span>
                    <small>
                      {sp.maxHealth} health · {sp.baseDust} dust · heals every {sp.epochsForHeal}
                    </small>
                    <em>{sp.blurb}</em>
                  </button>
                  <div className="ig-seed-buy">
                    <span className="ig-mono">×{held}</span>
                    {sp.seedCost > 0 && (
                      <button className="ig-btn ig-btn-quiet"
                        disabled={garden.dust < sp.seedCost}
                        onClick={() => garden.buySeed(sp.id)}>
                        {sp.seedCost} dust
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "commune" && (
        <div className="ig-panel-body">
          <p className="ig-label">The commune</p>
          <div className="ig-commune-bar">
            <i style={{ width: `${communePct * 100}%` }} />
          </div>
          <p className="ig-mono ig-commune-n">
            {garden.communePool} / {garden.communeGoal}
          </p>
          <p className="ig-hud-fine">
            Everyone&apos;s dust goes into the same bar. Nobody has said what
            happens when it fills.
            {garden.communeCycles > 0 && ` It has filled ${garden.communeCycles}×.`}
          </p>
          <div className="ig-water-btns">
            {[5, 25].map((n) => (
              <button key={n} className="ig-btn ig-btn-quiet"
                disabled={garden.dust < n} onClick={() => garden.donate(n)}>
                Give {n}
              </button>
            ))}
            <button className="ig-btn" disabled={garden.dust <= 0}
              onClick={() => garden.donate(garden.dust)}>
              Give all {garden.dust}
            </button>
          </div>
        </div>
      )}

      {/* ---- what happened ---- */}
      {garden.log.length > 0 && (
        <ol className="ig-log">
          {garden.log.slice(0, 4).map((s) => (
            <li key={s.epoch} className={s.met ? "" : "missed"}>
              <span className="ig-mono">e{s.epoch}</span>
              <span>
                needed {s.requirement}, drew {s.drawn} · +{s.dust} dust
                {s.died > 0 && <em> · {s.died} died</em>}
              </span>
              <b>{s.met ? "met" : "missed"}</b>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
