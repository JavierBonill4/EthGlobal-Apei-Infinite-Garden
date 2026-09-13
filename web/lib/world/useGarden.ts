"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REQ_MAX, rollRequirement } from "./mechanics";
import {
  REFILL_PER_PATCH, communeGoal, drawCap, fairShare, meanNeed,
  wellCapacity, wellRefill,
} from "./commons";
import {
  MY_PLOT, type Plot,
} from "./map";
import {
  SPECIES, STARTING_SPECIES, dustFor, newPlant, patchWater, plantKey,
  requirementFor, speciesById, stepPlant, totalMultiplier, type Plant,
} from "./plants";

/**
 * The whole game state, locally.
 *
 * TODO(wiring): nothing here touches the chain. Constants are mirrored from
 * Solidity (see mechanics.ts) rather than chosen, so replacing this hook with
 * wagmi writes should not change a number the player sees.
 */

/** Units per press of a per-plant water control. */
export const DRAW_STEP = 10;


export type Garden = ReturnType<typeof useGarden>;

export type Settlement = {
  epoch: number;
  /** The BASE that was rolled. Each plant needed base x its own multiplier. */
  requirement: number;
  /** Every plant met its own requirement. */
  met: boolean;
  metCount: number;
  of: number;
  drawn: number;
  dust: number;
  died: number;
  notes: string[];
};

export function useGarden() {
  const [plants, setPlants] = useState<Plant[]>([]);
  /** Seed inventory by species. You join with one simple seed and bare dirt. */
  const [seeds, setSeeds] = useState<Record<string, number>>({ [STARTING_SPECIES]: 1 });
  const [activeSeed, setActiveSeed] = useState<string>(STARTING_SPECIES);
  const [dust, setDust] = useState(0);

  /** Other gardeners with something alive in their patch. No multiplayer yet,
   *  so this is a dial -- but every shared number is already derived from it,
   *  which is the part that has to be right before players exist. */
  const [neighbourPatches, setNeighbourPatches] = useState(0);
  const [well, setWell] = useState(REFILL_PER_PATCH * 2);
  /**
   * Water given to each plant this epoch, keyed by tile.
   *
   * Per plant, not per patch: each plant is compared against its OWN
   * requirement at settlement, so pooling the water would throw away the
   * decision the whole change exists to create -- which plant do you save.
   */
  const [given, setGiven] = useState<Record<string, number>>({});
  const [epoch, setEpoch] = useState(1);
  const [log, setLog] = useState<Settlement[]>([]);
  const [note, setNote] = useState<string | null>(null);

  /** The commune pool. Nobody is told what filling it does. */
  const [communePool, setCommunePool] = useState(0);
  const [communeCycles, setCommuneCycles] = useState(0);
  const [congrats, setCongrats] = useState<number | null>(null);

  /** Testing only. Reveals the roll that is supposed to be unknown. */
  const [peek, setPeek] = useState(false);

  /** Always points at the freshest settle(); see the note by the skip actions. */
  const settleRef = useRef<(forced?: number) => void>(() => {});

  const say = useCallback((m: string) => {
    setNote(m);
    window.setTimeout(() => setNote((n) => (n === m ? null : n)), 3200);
  }, []);

  /** A Plot shaped like the rest of the app expects, derived from the plants. */
  const mine: Plot = useMemo(
    () => ({ ...MY_PLOT, water: patchWater(plants) }),
    [plants],
  );

  /**
   * A patch counts as active if something is ALIVE in it -- so letting your
   * garden die shrinks the well and the commune's target for everyone,
   * including you. Your own patch is one of them, when it has plants.
   */
  const activePatches = (plants.length > 0 ? 1 : 0) + neighbourPatches;
  const capacity = wellCapacity(activePatches);
  const refill = wellRefill(activePatches);
  const goal = communeGoal(activePatches, communeCycles);

  /** Thirst of everything in the ground. Prices the share, the cap and the need. */
  const thirst = useMemo(() => totalMultiplier(plants), [plants]);
  const cap = drawCap(thirst);
  const need = meanNeed(thirst);
  /** Entitlement is per PLANT, scaled by thirst -- not a lump sum per player. */
  const share = fairShare(activePatches, well, thirst);
  /** Total handed out this epoch, across every plant. */
  const drawn = useMemo(
    () => Object.values(given).reduce((a, b) => a + b, 0), [given],
  );
  /** Room left under this epoch's personal cap. */
  const drawRoom = Math.max(0, cap - drawn);
  /** Planted beyond what an average roll and a fair share can carry. */
  const overPlanted = need > share;

  /** No plants and no seeds: you cannot act at all without help. */
  const destitute = plants.length === 0 && Object.values(seeds).every((n) => n <= 0);

  const seedCount = useCallback((id: string) => seeds[id] ?? 0, [seeds]);
  const totalSeeds = useMemo(
    () => Object.values(seeds).reduce((a, b) => a + b, 0), [seeds],
  );

  /* ---- water: Garden.drawWater(plotId, amount) -------------------------- */
  /** The well is debited the FULL raw amount; the plot is credited
   *  effective(amount). That asymmetry is the game. */
  /**
   * Draw from the well and give it to ONE plant.
   *
   * Two separate limits, and they mean different things. The CAP is a rule
   * about you: nobody may take more than enough to be certain of what they
   * planted. The LEVEL is a fact about everyone: the water is simply not there.
   *
   * Note there is no WaterCurve here any more. The curve gave diminishing
   * credit on a draw, which made sense when water fed a health bar. Water now
   * meets a threshold, and a threshold is binary -- over-watering a plant is
   * already worth nothing, so a curve on top would be a second answer to a
   * question that has one.
   */
  const water = useCallback((key: string, units = DRAW_STEP) => {
    const capped = Math.min(units, cap - drawn);
    if (capped <= 0) { say(`You have taken this epoch's limit of ${cap}.`); return; }
    const got = Math.min(capped, Math.floor(well));
    if (got <= 0) { say("The well is empty. Somebody drew it down."); return; }
    setWell((w) => w - got);
    setGiven((g) => ({ ...g, [key]: (g[key] ?? 0) + got }));
    if (got < units) say(`Only ${got} left to take.`);
  }, [well, drawn, cap, say]);

  /** Take water back off a plant and return it to the well. Mistakes in an
   *  allocation puzzle should be correctable before settlement, not after. */
  const unwater = useCallback((key: string, units = DRAW_STEP) => {
    setGiven((g) => {
      const had = g[key] ?? 0;
      const back = Math.min(units, had);
      if (back <= 0) return g;
      setWell((w) => w + back);
      return { ...g, [key]: had - back };
    });
  }, []);

  const givenTo = useCallback((key: string) => given[key] ?? 0, [given]);

  /* ---- planting --------------------------------------------------------- */
  const plantSeed = useCallback((x: number, y: number) => {
    if (seedCount(activeSeed) <= 0) { say("No seeds of that kind."); return; }
    if (plants.some((p) => p.x === x && p.y === y)) { say("Something is already growing here."); return; }
    setSeeds((s) => ({ ...s, [activeSeed]: (s[activeSeed] ?? 0) - 1 }));
    setPlants((ps) => [...ps, newPlant(activeSeed, x, y)]);
    say(`Planted ${speciesById(activeSeed).name}.`);
  }, [activeSeed, plants, seedCount, say]);

  /** What a plant does on the next epoch that gets enough water. */
  const setIntent = useCallback((x: number, y: number, intent: "grow" | "heal") => {
    setPlants((ps) => ps.map((p) => (p.x === x && p.y === y ? { ...p, intent } : p)));
  }, []);

  const toggleIntent = useCallback((x: number, y: number) => {
    setPlants((ps) => ps.map((p) =>
      p.x === x && p.y === y ? { ...p, intent: p.intent === "grow" ? "heal" : "grow" } : p));
  }, []);

  /* ---- dust: spend on seeds, or give it away ---------------------------- */
  const buySeed = useCallback((id: string) => {
    const sp = speciesById(id);
    if (dust < sp.seedCost) { say(`Not enough ether dust — ${sp.seedCost} needed.`); return; }
    setDust((d) => d - sp.seedCost);
    setSeeds((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
    setActiveSeed(id);
    say(`A ${sp.name} seed is yours.`);
  }, [dust, say]);

  /**
   * Give dust to the commune.
   *
   * The bar has no explanation on purpose: you are asked to contribute to
   * something whose payoff you cannot evaluate. That is the point, and it is
   * why the reward on filling it is deliberately anticlimactic for now.
   */
  const donate = useCallback((amount: number) => {
    const give = Math.min(amount, dust);
    if (give <= 0) { say("No dust to give."); return; }
    setDust((d) => d - give);

    // Computed OUTSIDE the state updater. Two reasons: a single large gift can
    // fill the bar more than once and each fill raises the goal, so this has
    // to loop; and calling setState from inside another setState's updater
    // fires twice under StrictMode, which double-counted the cycles.
    // The goal is DERIVED from active patches and cycles, never stored -- if
    // it were stored it would go stale the moment somebody's garden died.
    let pool = communePool + give;
    let cycles = communeCycles;
    let filled = 0;
    let target = communeGoal(activePatches, cycles);
    while (pool >= target) {
      pool -= target;
      cycles += 1;
      filled += 1;
      target = communeGoal(activePatches, cycles);
    }
    setCommunePool(pool);
    if (filled > 0) {
      setCommuneCycles(cycles);
      setCongrats(target);
    }
  }, [dust, communePool, communeCycles, activePatches, say]);

  const dismissCongrats = useCallback(() => setCongrats(null), []);

  /* ---- settlement ------------------------------------------------------- */
  /**
   * Garden.settleBegin() plus the randomness callback, collapsed.
   *
   * `forced` is for the test panel: pass a requirement to stop it being a
   * roll. Production has no such parameter, obviously.
   */
  const settle = useCallback((forced?: number) => {
    // The roll is a BASE now, not a finished requirement. Each plant scales it
    // by its own multiplier, so one epoch can water the clover and drown
    // nothing else.
    const base = forced ?? rollRequirement();

    let gained = 0;
    let died = 0;
    let metCount = 0;
    const notes: string[] = [];
    const next: Plant[] = [];

    for (const p of plants) {
      gained += dustFor(p);                     // alive plants always pay
      const req = requirementFor(p, base);
      const met = (given[plantKey(p)] ?? 0) >= req;
      if (met) metCount += 1;
      const r = stepPlant(p, met);
      notes.push(`${r.note} (needed ${req}, had ${given[plantKey(p)] ?? 0})`);
      if (r.next) next.push(r.next);
      else died += 1;
    }
    const met = plants.length > 0 && metCount === plants.length;

    // DEATH CONSUMES THE SEED. It used to hand it back, which made neglect a
    // setback you could always walk off -- and meant no player could ever be
    // in the position the whole mutual-aid idea depends on. Lose everything
    // and you cannot act at all: the only ways back are another gardener
    // giving you a seed, or finding one in the woodland.
    setPlants(next);
    setDust((d) => d + gained);
    // Refill and ceiling both follow the population, and the population may
    // have just changed -- a patch that died this epoch stops counting.
    const activeAfter = (next.length > 0 ? 1 : 0) + neighbourPatches;
    setWell((w) => Math.min(wellCapacity(activeAfter), w + wellRefill(activeAfter)));
    setLog((l) => [{
      epoch, requirement: base, met, drawn, dust: gained, died, notes,
      metCount, of: plants.length,
    }, ...l].slice(0, 10));
    setGiven({});
    setEpoch((e) => e + 1);
  }, [given, drawn, epoch, plants, neighbourPatches]);

  /* ---- test harness ----------------------------------------------------- */
  /** Draw exactly enough that the epoch cannot be missed, then settle. */
  /** Give every plant exactly what a worst-case base would demand, then settle
   *  against that base. Still charged to the commons -- the cheat is the
   *  certainty, not free water. */
  const skipGood = useCallback(() => {
    const alloc: Record<string, number> = {};
    let total = 0;
    for (const p of plants) {
      const need = requirementFor(p, REQ_MAX);
      alloc[plantKey(p)] = need;
      total += need;
    }
    setGiven(alloc);
    setWell((w) => Math.max(0, w - total));
    window.setTimeout(() => settleRef.current(REQ_MAX), 0);
  }, [plants]);
  /** Settle having given nothing: every plant takes a point. */
  const skipBad = useCallback(() => {
    setGiven({});
    window.setTimeout(() => settleRef.current(REQ_MAX), 0);
  }, []);
  /**
   * A seed arriving from outside: gifted by another gardener, or found in the
   * woodland. The only way out of a dead patch, on purpose.
   *
   * TODO(wiring): the gift half needs a real transfer -- one address giving a
   * seed to another. Today it is the same entry point for both sources.
   */
  const receiveSeed = useCallback((id: string, from: string) => {
    setSeeds((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
    setActiveSeed(id);
    say(`A ${speciesById(id).name} seed, ${from}.`);
  }, [say]);

  const grantDust = useCallback((n: number) => setDust((d) => d + n), []);
  const grantSeed = useCallback((id: string) =>
    setSeeds((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 })), []);
  const resetAll = useCallback(() => {
    setPlants([]); setSeeds({ [STARTING_SPECIES]: 1 }); setActiveSeed(STARTING_SPECIES);
    setDust(0); setWell(REFILL_PER_PATCH * 2); setGiven({}); setEpoch(1); setLog([]);
    setCommunePool(0); setCommuneCycles(0); setCongrats(null);
  }, []);
  /** Testing: strip the patch bare, to see the destitute state. */
  const killAll = useCallback(() => { setPlants([]); setSeeds({}); }, []);

  // settle() closes over `drawn`, so the skip helpers cannot call the version
  // they captured -- they would settle against last render's draw. A ref keeps
  // them pointed at the freshest one.
  useEffect(() => { settleRef.current = settle; }, [settle]);

  return {
    plants, seeds, seedCount, totalSeeds, activeSeed, setActiveSeed,
    dust, well, drawn, epoch, log, note, mine,
    activePatches, neighbourPatches, setNeighbourPatches,
    capacity, refill, share, drawRoom, destitute,
    thirst, cap, need, overPlanted, given, givenTo, unwater,
    communePool, communeGoal: goal, communeCycles, congrats, dismissCongrats,
    peek, setPeek,
    water, plantSeed, setIntent, toggleIntent, buySeed, donate, settle, say,
    skipGood, skipBad, grantDust, grantSeed, receiveSeed, resetAll, killAll,
    species: SPECIES,
  };
}
