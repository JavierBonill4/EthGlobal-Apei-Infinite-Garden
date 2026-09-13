/**
 * The seed economy.
 *
 * WHY THIS FILE EXISTS
 * OPEN-QUESTIONS.md deferred the challenge loop for one reason: "seeds are
 * unmetered today -- contributeSeeds doesn't debit an inventory that doesn't
 * exist." This is that inventory, plus the fork DESIGN.md 03 specifies for it.
 *
 * Every constant with a Solidity citation is COPIED, not chosen. The ones
 * without a citation are proposals and say so.
 */
import { HEALTH_MAX, type Band } from "./mechanics";

/* ---- copied from contracts/src/Farm.sol ---------------------------------- */

/** Farm.sol:24 -- seeds below this in a single epoch produce NOTHING. */
export const COORDINATION_THRESHOLD = 40;
/** Farm.sol:27 -- conversion once the threshold clears. */
export const SEED_YIELD = 3;
/** Farm.sol:30 -- per logged-off farm worker, capped by seeds present. */
export const LABOUR_YIELD = 2;
/** Deploy.s.sol FARM_BASE -- the free floor of nutrients per epoch. */
export const FARM_BASE = 50;
/** Garden.sol:57 -- nutrient health a plot needs to count toward completion. */
export const NUTRIENT_FLOOR = 300;

/* ---- proposals: not in any contract yet ---------------------------------- */

/**
 * PROPOSAL. What a tended garden yields at settlement.
 *
 * DESIGN.md says seeds come from challenges. It does not say gardens produce
 * them, so this is an extension -- see docs/VIEWS-AND-ECONOMY.md 05. The
 * tuning constraint is the only load-bearing part:
 *
 *   small enough that a player who never leaves cannot reach a T4 collectible,
 *   large enough that a player who never solves a puzzle still plays.
 *
 * Keyed off the band already on screen, so a player reads next epoch's income
 * by looking at their garden. No hidden state.
 */
export const SEEDS_PER_EPOCH: Record<Band, number> = {
  thriving: 3,
  steady: 1,
  stressed: 0,
  dying: 0,
};

/**
 * PROPOSAL. Nutrient health from planting one seed on your own plot.
 *
 * Deliberately 1 against the farm's 3, so giving is three times better and
 * might be worth nothing at all. Do not raise this to make planting feel
 * better -- the gap IS the fork. If the prototype feels slow, shorten the
 * epoch; scaling these changes the thing you are trying to test.
 *
 * Needs Garden.plantSeeds(plotId, amount), which does not exist yet.
 */
export const PLANT_YIELD = 1;

/**
 * A CONSEQUENCE WORTH READING BEFORE TUNING ANYTHING.
 *
 * The threshold is 40 seeds per epoch. A thriving plot yields 3. So fourteen
 * thriving plots, all giving everything, barely clear it -- and three players
 * cannot clear it at all, however perfectly they cooperate.
 *
 * That is not a bug in the numbers. It is what makes Adventure load-bearing:
 * at small player counts the only way over the line is for somebody to leave
 * the garden and bring back a cache. Check this number again if you ever
 * change garden yield, because it silently decides whether Adventure is
 * content or decoration.
 */
export function plotsNeededToClearThreshold(yieldPerPlot = SEEDS_PER_EPOCH.thriving) {
  return Math.ceil(COORDINATION_THRESHOLD / Math.max(1, yieldPerPlot));
}

export type FarmState = {
  /** Nutrients available to buy right now. */
  stock: number;
  /** Reset every settlement. */
  seedsThisEpoch: number;
  labourThisEpoch: number;
};

export const freshFarm = (): FarmState => ({
  stock: FARM_BASE,
  seedsThisEpoch: 0,
  labourThisEpoch: 0,
});

/**
 * Farm.produce(), transcribed. The discontinuity is the feature: contributions
 * under the threshold are wasted entirely. Do not soften this into a linear
 * payout to make it fairer.
 */
export function produce(f: FarmState): { next: FarmState; produced: number; wasted: number } {
  let produced = FARM_BASE;
  let wasted = 0;
  if (f.seedsThisEpoch >= COORDINATION_THRESHOLD) {
    produced += f.seedsThisEpoch * SEED_YIELD;
    // Labour only multiplies work that already exists. Farm workers with no
    // seeds to tend achieve nothing, on purpose.
    const labour = Math.min(f.labourThisEpoch * LABOUR_YIELD, f.seedsThisEpoch);
    produced += labour;
  } else {
    wasted = f.seedsThisEpoch;
  }
  return {
    next: { stock: f.stock + produced, seedsThisEpoch: 0, labourThisEpoch: 0 },
    produced,
    wasted,
  };
}

/** How far off the cliff we are, for a HUD that has to make the cliff visible. */
export function thresholdState(f: FarmState) {
  const short = Math.max(0, COORDINATION_THRESHOLD - f.seedsThisEpoch);
  return {
    given: f.seedsThisEpoch,
    short,
    clears: short === 0,
    pct: Math.min(1, f.seedsThisEpoch / COORDINATION_THRESHOLD),
    ifItClears: f.seedsThisEpoch * SEED_YIELD,
  };
}

export const nutrientBandOk = (n: number) => n >= NUTRIENT_FLOOR;
export const nutrientPct = (n: number) => Math.min(1, n / HEALTH_MAX);
