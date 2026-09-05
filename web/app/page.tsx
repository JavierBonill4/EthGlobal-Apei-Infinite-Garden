"use client";

import { useCallback, useState } from "react";
import { Overworld } from "../components/world/Overworld";
import { Hud } from "../components/world/Hud";
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
 */
export default function Home() {
  const garden = useGarden();
  const [challenge, setChallenge] = useState<ChallengeKey | null>(null);

  const enter = useCallback((c: ChallengeKey) => setChallenge(c), []);
  const close = useCallback(() => setChallenge(null), []);

  return (
    <main className="ig-game">
      <div className="ig-game-main">
        <header className="ig-game-head">
          <p className="ig-label">Season 1 · epoch {garden.epoch} · local prototype, no chain</p>
          <h1>The Garden</h1>
        </header>
        <Overworld garden={garden} onEnterPortal={enter} frozen={challenge !== null} />
      </div>
      <Hud garden={garden} />
      <ChallengeHost which={challenge} onClose={close} onReward={garden.grantCistern} />
    </main>
  );
}
