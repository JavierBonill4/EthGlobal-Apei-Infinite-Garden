"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectColours } from "./ConnectColours";
import { TiltPlane } from "./TiltPlane";
import type { ChallengeKey } from "./types";

const REGISTRY = {
  connect: { title: "Connect the colours", node: ConnectColours },
  tilt: { title: "Tilt the plane", node: TiltPlane },
} as const;

/** TODO(mechanics): payout is a proposal. See useGarden.waterFromCistern. */
export const CISTERN_REWARD = 30;

/**
 * Leaving the plane.
 *
 * The transition is the point of the portal, not decoration. The overworld is
 * a place you stand in; a challenge is not anywhere. So the ground plane tips
 * away and the puzzle arrives on a surface of its own, and coming back puts
 * you exactly where you were standing. If this ever becomes a modal that fades
 * in over the garden, the portal has stopped meaning anything.
 */
export function ChallengeHost({
  which,
  onClose,
  onReward,
}: {
  which: ChallengeKey | null;
  onClose: () => void;
  onReward: (units: number) => void;
}) {
  const [solved, setSolved] = useState(false);

  useEffect(() => { setSolved(false); }, [which]);

  const solve = useCallback(() => {
    setSolved(true);
    onReward(CISTERN_REWARD);
  }, [onReward]);

  useEffect(() => {
    if (!which) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [which, onClose]);

  if (!which) return null;
  const entry = REGISTRY[which];
  const Node = entry.node;

  return (
    <div className="ig-plane" role="dialog" aria-modal="true" aria-label={entry.title}>
      <div className="ig-plane-card">
        <header className="ig-plane-head">
          <p className="ig-label">Off the plane · placeholder challenge</p>
          <h2>{entry.title}</h2>
        </header>

        {solved ? (
          <div className="ig-plane-done">
            <p className="ig-plane-big">+{CISTERN_REWARD} units to your cistern</p>
            <p>
              Water that did not come out of the well. Nobody else paid for it —
              which is exactly why this number is dangerous and marked as a
              proposal in the code.
            </p>
            <button className="ig-btn" onClick={onClose} autoFocus>Back to the garden</button>
          </div>
        ) : (
          <>
            <Node onSolved={solve} />
            <button className="ig-btn ig-btn-quiet" onClick={onClose}>
              Leave it (<kbd>Esc</kbd>)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
