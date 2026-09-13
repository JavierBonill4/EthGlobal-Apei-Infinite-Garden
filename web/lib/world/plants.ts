/**
 * Plants: species, stats, and the rules that move them.
 *
 * THE ONE RULE EVERYTHING HANGS OFF
 * "Sufficient water" is the epoch's HIDDEN requirement -- the same roll from
 * REQ_MIN..REQ_MAX that nobody sees until every draw is locked. Plants do not
 * get their own private threshold, because then watering becomes arithmetic
 * and the well stops being a commons. Your plants live or suffer by the same
 * unknown everyone else is facing.
 *
 * THE RARITY TRADE
 * Rarer plants make more ether dust and are more fragile: lower max health,
 * and more consecutive healing epochs to win a single point back. So rarity is
 * not "better", it is "worth more and harder to keep alive" -- which is the
 * only kind of rarity that creates a decision.
 */
import { HEALTH_MAX } from "./mechanics";

export type Rarity = "common" | "uncommon" | "rare" | "mythic";

export type Species = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Also the starting health. Rarer is more fragile. */
  maxHealth: number;
  /** Base ether dust per epoch at stage 0. Rarer pays more. */
  baseDust: number;
  maxStage: number;
  /** Consecutive healing epochs to win ONE point of health back. */
  epochsForHeal: number;
  /**
   * Thirst, as a multiple of the epoch's BASE roll. Clover is exactly 1 --
   * it is the reference plant, and every other number in the water economy is
   * expressed against it.
   *
   * The band is real: an individual plant rolls its own multiplier out of it
   * when sown and keeps it for life. So YOUR moonflower's thirst is a fact you
   * can read off it, while the base is still unknown until settlement. One
   * layer of hidden information, not two -- doubly-unknown water would make
   * rare plants a lottery rather than a commitment.
   */
  waterMin: number;
  waterMax: number;
  /** Dust price of a seed. The starting species is free. */
  seedCost: number;
  blurb: string;
};

/**
 * TODO(tuning): every number here is a first guess. The shape is what matters:
 * dust goes up with rarity, health goes down, healing gets slower. Keep those
 * three moving in those directions and the trade survives retuning.
 */
export const SPECIES: Species[] = [
  {
    id: "clover", name: "Clover", rarity: "common",
    maxHealth: 6, baseDust: 1, maxStage: 4, epochsForHeal: 2, seedCost: 0,
    waterMin: 1.0, waterMax: 1.0,
    blurb: "Hardy and unremarkable. Forgives a bad week.",
  },
  {
    id: "marigold", name: "Marigold", rarity: "uncommon",
    maxHealth: 5, baseDust: 2, maxStage: 5, epochsForHeal: 3, seedCost: 14,
    waterMin: 1.2, waterMax: 1.5,
    blurb: "Pays better. Notices when you are away.",
  },
  {
    id: "foxglove", name: "Foxglove", rarity: "rare",
    maxHealth: 4, baseDust: 4, maxStage: 5, epochsForHeal: 4, seedCost: 45,
    waterMin: 1.6, waterMax: 2.0,
    blurb: "Generous and brittle. Three bad epochs is most of its life.",
  },
  {
    id: "moonflower", name: "Moonflower", rarity: "mythic",
    maxHealth: 3, baseDust: 7, maxStage: 6, epochsForHeal: 5, seedCost: 130,
    waterMin: 2.0, waterMax: 3.0,
    blurb: "Extraordinary, and almost impossible to nurse back.",
  },
];

export const speciesById = (id: string) =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0];

/** The seed every farmer joins with. */
export const STARTING_SPECIES = "clover";

/** Each stage adds this fraction of base dust. "Stats get slightly increased." */
export const STAGE_DUST_BONUS = 0.5;

export type Plant = {
  /** Tile it occupies, inside your own plot. */
  x: number;
  y: number;
  speciesId: string;
  /** Rolled out of the species band when sown, fixed for life. This plant's
   *  requirement each epoch is `round(base * multiplier)`. */
  multiplier: number;
  health: number;
  stage: number;
  /** Consecutive healing epochs banked toward the next point of health. */
  healStreak: number;
  /** What this plant does on the NEXT epoch that gets enough water. */
  intent: "grow" | "heal";
};

export function newPlant(speciesId: string, x: number, y: number, rand = Math.random): Plant {
  const sp = speciesById(speciesId);
  // Two decimals: enough that no two moonflowers are identical, few enough
  // that the number on screen is readable.
  const multiplier = Math.round((sp.waterMin + (sp.waterMax - sp.waterMin) * rand()) * 100) / 100;
  return {
    x, y, speciesId, multiplier,
    health: sp.maxHealth, stage: 0, healStreak: 0, intent: "grow",
  };
}

/** A stable key for one plant's tile. Used for per-plant water allocation. */
export const plantKey = (p: { x: number; y: number }) => `${p.x},${p.y}`;

/** What this plant needs THIS epoch, given the base that was rolled. */
export const requirementFor = (p: Plant, base: number) => Math.round(base * p.multiplier);

/** The band a plant's requirement can fall in, which the player CAN see. */
export function requirementBand(p: Plant, reqMin: number, reqMax: number) {
  return { min: Math.round(reqMin * p.multiplier), max: Math.round(reqMax * p.multiplier) };
}

/** Sum of thirst across a patch. Everything in the water economy is priced
 *  against this: fair share, the draw cap, and whether you have over-planted. */
export const totalMultiplier = (plants: Plant[]) =>
  plants.reduce((a, p) => a + p.multiplier, 0);

/** Dust a living plant pays THIS epoch. Paid whether or not it was watered --
 *  neglect costs you by killing the plant, not by switching off the tap. */
export function dustFor(p: Plant): number {
  const sp = speciesById(p.speciesId);
  return Math.round(sp.baseDust * (1 + p.stage * STAGE_DUST_BONUS));
}

/** Dust it WOULD pay next epoch if it advanced a stage. For the HUD. */
export function dustAtNextStage(p: Plant): number {
  const sp = speciesById(p.speciesId);
  const stage = Math.min(sp.maxStage, p.stage + 1);
  return Math.round(sp.baseDust * (1 + stage * STAGE_DUST_BONUS));
}

/** Healing is only worth choosing when there is something to heal. */
export const canHeal = (p: Plant) => p.health < speciesById(p.speciesId).maxHealth;
export const atMaxStage = (p: Plant) => p.stage >= speciesById(p.speciesId).maxStage;

/**
 * One epoch, for one plant. Pure: returns the next plant, or null if it died.
 *
 * `met` is whether the patch drew enough to clear the epoch's hidden
 * requirement. Everything else follows from it.
 */
export function stepPlant(p: Plant, met: boolean): { next: Plant | null; note: string } {
  const sp = speciesById(p.speciesId);

  if (!met) {
    // A missed epoch costs one point of health and breaks any healing streak.
    // Consecutive is the whole point: nursing a rare plant back means not
    // missing, five epochs running.
    const health = p.health - 1;
    if (health <= 0) {
      return { next: null, note: `${sp.name} died. Its seed is yours to replant.` };
    }
    return { next: { ...p, health, healStreak: 0 }, note: `${sp.name} lost a point of health.` };
  }

  if (p.intent === "heal" && canHeal(p)) {
    const streak = p.healStreak + 1;
    if (streak >= sp.epochsForHeal) {
      return {
        next: { ...p, health: Math.min(sp.maxHealth, p.health + 1), healStreak: 0 },
        note: `${sp.name} healed a point.`,
      };
    }
    return {
      next: { ...p, healStreak: streak },
      note: `${sp.name} is mending — ${sp.epochsForHeal - streak} more in a row.`,
    };
  }

  if (atMaxStage(p)) {
    return { next: { ...p, healStreak: 0 }, note: `${sp.name} is fully grown.` };
  }
  return {
    next: { ...p, stage: p.stage + 1, healStreak: 0 },
    note: `${sp.name} grew to stage ${p.stage + 1}.`,
  };
}

/**
 * Which bed sprite to draw. There are four, and no new art is being made, so
 * health maps onto them as a fraction of THIS species' max -- a mythic on 2 of
 * 3 is in better shape than a clover on 2 of 6, and should look it.
 */
export function plantBand(p: Plant): "thriving" | "steady" | "stressed" | "dying" {
  const sp = speciesById(p.speciesId);
  const f = p.health / sp.maxHealth;
  if (f >= 0.75) return "thriving";
  if (f >= 0.5) return "steady";
  if (f >= 0.25) return "stressed";
  return "dying";
}

/** Seedlings are small and mature plants fill the bed. Growth you can see,
 *  from the sprites that already exist. */
export function plantScale(p: Plant): number {
  const sp = speciesById(p.speciesId);
  return 0.5 + 0.5 * (p.stage / Math.max(1, sp.maxStage));
}

/** Patch-level water health, so the existing HUD band still means something.
 *  The average condition of what is actually growing. */
export function patchWater(plants: Plant[]): number {
  if (plants.length === 0) return 0;
  const f = plants.reduce((a, p) => a + p.health / speciesById(p.speciesId).maxHealth, 0) / plants.length;
  return Math.round(f * HEALTH_MAX);
}
