"use client";

import { useCallback, useState } from "react";
import { Overworld } from "../components/world/Overworld";
import { AdventureView } from "../components/world/AdventureView";
import { Hud } from "../components/world/Hud";
import { DevPanel } from "../components/world/DevPanel";
import { ChallengeHost } from "../components/challenges/ChallengeHost";
import type { ChallengeKey } from "../components/challenges/types";
import { useGarden } from "../lib/world/useGarden";

/**
 * The game is the home screen.
 *
 * The old scaffold (well panel, flat plot grid, ledger) has not been deleted --
 * the ledger is the demo and it now lives inside the HUD, behind a toggle. The
 * flat plot grid is gone because the world replaces it: you no longer look at
 * six squares, you stand in one of them.
 *
 * TODO(wiring): everything below is client-side. See lib/world/useGarden.ts --
 * each mutation names the contract call it stands for.
 *
 * TWO VIEWS, for now. The garden is home base; the woodland is somewhere you
 * GO, and it hides the HUD while you are there -- being away is meant to cost
 * you something you cannot sit and watch. The standalone previews in
 * art/backgrounds/ are the third way in: temp-home-garden links out to both
 * stroll and garden-state without needing the app to run at all.
 */
type View = "garden" | "adventure";

export default function Home() {
  const garden = useGarden();
  const [challenge, setChallenge] = useState<ChallengeKey | null>(null);
  const [view, setView] = useState<View>("garden");

  const close = useCallback(() => setChallenge(null), []);

  const adventure = view === "adventure";

  return (
    <main className={adventure ? "ig-game ig-game-full" : "ig-game"}>
      <div className="ig-game-main">
        <header className="ig-game-head">
          <div>
            <p className="ig-label">
              Season 1 · epoch {garden.epoch} · local prototype, no chain
            </p>
            <h1>The Garden</h1>
          </div>
          <nav className="ig-tabs">
            <button className={adventure ? "" : "on"} onClick={() => setView("garden")}>
              Garden
            </button>
            <button className={adventure ? "on" : ""} onClick={() => setView("adventure")}>
              Woodland
            </button>
          </nav>
        </header>

        {adventure
          ? <AdventureView onLeave={() => setView("garden")} garden={garden} />
          : <Overworld
              garden={garden}
              frozen={challenge !== null}
              onLeave={() => setView("adventure")}
              /* New tab on purpose. The Garden State preview is a standalone
                 page under /art, so navigating there in this tab would throw
                 away the epoch, the well and everything you have drawn. The
                 signpost is a view, not an exit from the run. */
              onViewGardenState={() =>
                window.open("/art/backgrounds/garden-state/garden-state-preview.html", "_blank")}
            />}
      </div>

      {/* No HUD in the woodland. That is the rule that makes being away
          actually cost something rather than just look different. */}
      {!adventure && <Hud garden={garden} />}

      {/* Test harness. Gate this on an env flag before anyone plays. */}
      <DevPanel garden={garden} />

      {garden.note && <div className="ig-global-note">{garden.note}</div>}

      {/* The commune filled. Deliberately anticlimactic: you are not told what
          it did, only that the next one is bigger. */}
      {garden.congrats !== null && (
        <div className="ig-plane" role="dialog" aria-modal="true">
          <div className="ig-plane-card">
            <p className="ig-label">The commune</p>
            <h2>Congratulations</h2>
            <p>
              The bar filled. Something happened, or nothing did — nobody has
              said. The next one needs {garden.congrats}.
            </p>
            <button className="ig-btn" onClick={garden.dismissCongrats} autoFocus>
              Back to the garden
            </button>
          </div>
        </div>
      )}

      <ChallengeHost which={challenge} onClose={close} onReward={garden.grantDust} />
    </main>
  );
}
