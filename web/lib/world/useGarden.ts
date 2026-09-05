"use client";

import { useCallback, useState } from "react";
import {
  DECAY_NORMAL, HEALTH_MAX, WELL_CAPACITY, WELL_REFILL,
  effective, rollRequirement,
} from "./mechanics";
import { PLOTS, type Plot } from "./map";

/**
 * The whole game state, locally.
 *
 * TODO(wiring): every mutation below has exactly one contract call behind it,
 * named in its comment. Replacing this hook with wagmi writes should not
 * change a single number the player sees -- that is why mechanics.ts mirrors
 * the Solidity constants instead of picking pleasant ones.
 */

/** Units taken from the well per press. Small enough that watering is a choice
 *  you keep making, rather than one button that solves the epoch. */
export const DRAW_STEP = 10;

export type Garden = ReturnType<typeof useGarden>;

export type Settlement = {
  epoch: number;
  requirement: number;
  met: boolean;
  drawn: number;
  wellAfter: number;
};

export function useGarden() {
  const [plots, setPlots] = useState<Plot[]>(() => PLOTS.map((p) => ({ ...p })));
  const [well, setWell] = useState(WELL_CAPACITY * 0.62);
  const [drawn, setDrawn] = useState(0);           // your raw draw this epoch
  const [epoch, setEpoch] = useState(1);
  const [cistern, setCistern] = useState(0);       // see grantCistern
  const [log, setLog] = useState<Settlement[]>([]);
  const [flash, setFlash] = useState(0);           // ticks the bed animation

  const mine = plots.find((p) => p.mine)!;

  /**
   * Garden.drawWater(plotId, amount).
   *
   * The asymmetry is the point and it is enforced here too: the WELL is
   * debited the full raw amount, the PLOT is credited effective(amount).
   */
  const water = useCallback(() => {
    if (well < DRAW_STEP) return "The well is empty.";
    setWell((w) => w - DRAW_STEP);
    setDrawn((d) => d + DRAW_STEP);
    setPlots((ps) =>
      ps.map((p) =>
        p.mine ? { ...p, water: Math.min(HEALTH_MAX, p.water + effective(DRAW_STEP) * 4) } : p,
      ),
    );
    setFlash((f) => f + 1);
    return null;
  }, [well]);

  /**
   * Watering from your own cistern: costs the commons nothing.
   *
   * TODO(mechanics): PROPOSAL, NOT A DECISION. Challenges currently pay out
   * private water, which gives portals a reason to exist inside this game's
   * economy rather than beside it -- effort you can substitute for a draw.
   * It is also the most dangerous idea in this commit: if cistern water is
   * ever cheap enough, the dilemma stops binding and the whole thing becomes
   * a farming sim. Either tune it hard or throw it out. See
   * docs/OPEN-QUESTIONS.md before keeping it.
   */
  const waterFromCistern = useCallback(() => {
    if (cistern < DRAW_STEP) return "Your cistern is empty.";
    setCistern((c) => c - DRAW_STEP);
    setPlots((ps) =>
      ps.map((p) =>
        p.mine ? { ...p, water: Math.min(HEALTH_MAX, p.water + effective(DRAW_STEP) * 4) } : p,
      ),
    );
    setFlash((f) => f + 1);
    return null;
  }, [cistern]);

  const grantCistern = useCallback((units: number) => setCistern((c) => c + units), []);

  /**
   * Garden.settleBegin() plus the randomness callback, collapsed.
   *
   * On-chain these are two phases on purpose and the second one only happens
   * when somebody rolls the dice -- see README "The one thing that will
   * confuse you". Locally there is nobody to wait for, so this does both.
   */
  const settle = useCallback(() => {
    const requirement = rollRequirement();
    const met = drawn >= requirement;
    setPlots((ps) =>
      ps.map((p) => {
        if (p.wilderness) return p;
        const missed = p.mine ? !met : p.water < 400;   // TODO(wiring): neighbours from chain
        return missed ? { ...p, water: Math.max(0, p.water - DECAY_NORMAL) } : p;
      }),
    );
    const wellAfter = Math.min(WELL_CAPACITY, well + WELL_REFILL);
    setWell(wellAfter);
    setLog((l) => [{ epoch, requirement, met, drawn, wellAfter }, ...l].slice(0, 8));
    setDrawn(0);
    setEpoch((e) => e + 1);
  }, [drawn, epoch, well]);

  return {
    plots, mine, well, drawn, epoch, cistern, log, flash,
    water, waterFromCistern, grantCistern, settle,
  };
}
