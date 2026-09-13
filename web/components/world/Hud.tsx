"use client";

import { useState } from "react";
import { REQ_MAX, REQ_MIN } from "../../lib/world/mechanics";
import {
  DRAW_CAP_PER_EPOCH, MEAN_REQUIREMENT, REFILL_PER_PATCH,
} from "../../lib/world/commons";
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
  const wellPct = Math.round((garden.well / Math.max(1, garden.capacity)) * 100);
  const communePct = Math.min(1, garden.communePool / garden.communeGoal);
  const incoming = garden.plants.reduce((a, p) => a + dustFor(p), 0);

  return (
    <aside className="ig-hud">
      {/* Nothing you can do alone. This is the state the whole mutual-aid idea
          depends on existing, so it is stated plainly rather than softened. */}
      {garden.destitute && (
        <div className="ig-destitute">
          <p className="ig-label">Your patch is dead</p>
          <p>
            No plants, no seeds. Watering does nothing and there is nothing to
            tend. You cannot start again on your own — someone has to give you
            a seed, or you have to find one in the woodland.
          </p>
        </div>
      )}

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
          <button className="ig-btn ig-btn-quiet" disabled={garden.drawRoom <= 0}
            onClick={() => garden.water(10)}>+10</button>
          <button className="ig-btn ig-btn-quiet" disabled={garden.drawRoom <= 0}
            onClick={() => garden.water(garden.share)}>
            Fair share
          </button>
          <button className="ig-btn ig-btn-quiet" disabled={garden.drawRoom <= 0}
            onClick={() => garden.water(garden.drawRoom)}>
            Take {garden.drawRoom}
          </button>
          <button className="ig-btn" onClick={() => garden.settle()}>
            Settle epoch {garden.epoch}
          </button>
        </div>
        <div className="ig-bar ig-bar-well" style={{ marginTop: ".55rem" }}>
          <i style={{ width: `${wellPct}%` }} />
          {/* Where your fair share sits on the bar. The interesting decision is
              whether to cross it, so it has to be visible to be a decision. */}
          <b className="ig-share-mark"
             style={{ left: `${Math.min(100, (garden.share / Math.max(1, garden.capacity)) * 100)}%` }} />
        </div>
        <p className="ig-hud-fine">
          The well holds <b className="ig-mono">{Math.round(garden.well).toLocaleString()}</b> of{" "}
          {garden.capacity.toLocaleString()}, refilling{" "}
          <b className="ig-mono">{garden.refill}</b> an epoch — both sized by{" "}
          <b className="ig-mono">{garden.activePatches}</b> active{" "}
          {garden.activePatches === 1 ? "patch" : "patches"}
          {/* A world with nobody in it still has a well, or there would be no
              way back into it. The floor is one patch, and saying "0 patches"
              beside numbers computed from 1 is just a lie. */}
          {garden.activePatches === 0 && " — held at a one-patch floor"}.
        </p>
        <p className="ig-hud-fine ig-share-note">
          Your fair share is <b className="ig-mono">{garden.share}</b>. The
          requirement averages <b className="ig-mono">{MEAN_REQUIREMENT}</b>, so
          taking your share meets it about half the time. Certainty costs{" "}
          <b className="ig-mono">{DRAW_CAP_PER_EPOCH}</b> — this epoch&apos;s
          limit, and {(DRAW_CAP_PER_EPOCH / REFILL_PER_PATCH).toFixed(1)}× your
          share. You have <b className="ig-mono">{garden.drawRoom}</b> left to take.
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
            Everyone&apos;s dust goes into the same bar, and the target is{" "}
            {garden.activePatches} active{" "}
            {garden.activePatches === 1 ? "patch" : "patches"} worth — a bigger
            garden is asked for more. Nobody has said what happens when it fills.
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
