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
  /** Dust price of a seed. The starting species is free. */
  seedCost: number;
  blurb: string;
};

/**
 * TWELVE SPECIES, THREE PER RARITY
 *
 * The set (and its order) comes from a hand-drawn icon set, ranked by the
 * artist from most humble to most prestigious -- witchgrass first, stargazer
 * lily last. That ranking IS the rarity ladder: every field moves in the
 * direction the rarity trade demands (health down, dust up, healing slower,
 * seed cost up) as you read down the list. Numbers are a first guess --
 * TODO(tuning) -- but the shape is load-bearing, not the exact digits.
 */
export const SPECIES: Species[] = [
  // -- common: cheap, tough, pays almost nothing --
  {
    id: "witchgrass", name: "Witchgrass", rarity: "common",
    maxHealth: 7, baseDust: 1, maxStage: 3, epochsForHeal: 2, seedCost: 0,
    blurb: "Grows in the cracks. Nothing kills it and nothing pays for it.",
  },
  {
    id: "pennywort", name: "Pennywort", rarity: "common",
    maxHealth: 6, baseDust: 1, maxStage: 4, epochsForHeal: 2, seedCost: 5,
    blurb: "Small, round, and patient. A step up that barely costs anything.",
  },
  {
    id: "bracken", name: "Bracken", rarity: "common",
    maxHealth: 6, baseDust: 2, maxStage: 4, epochsForHeal: 3, seedCost: 10,
    blurb: "Unrolls slow, frond by frond. Common, but never in a hurry.",
  },
  // -- uncommon: a real trade starts here --
  {
    id: "snowpea", name: "Snowpea", rarity: "uncommon",
    maxHealth: 5, baseDust: 2, maxStage: 5, epochsForHeal: 3, seedCost: 14,
    blurb: "Pods before petals. Pays out early, dies out faster than grass ever would.",
  },
  {
    id: "hosta", name: "Hosta", rarity: "uncommon",
    maxHealth: 5, baseDust: 3, maxStage: 5, epochsForHeal: 3, seedCost: 20,
    blurb: "Broad leaves, broad appetite. Notices a dry week.",
  },
  {
    id: "tulip", name: "Tulip", rarity: "uncommon",
    maxHealth: 4, baseDust: 3, maxStage: 5, epochsForHeal: 4, seedCost: 28,
    blurb: "One bloom, all the risk in a single stem.",
  },
  // -- rare: generous, and it shows every bruise --
  {
    id: "hydrangea", name: "Hydrangea", rarity: "rare",
    maxHealth: 4, baseDust: 4, maxStage: 5, epochsForHeal: 4, seedCost: 45,
    blurb: "A whole bouquet on one root. Generous, and it shows every bruise.",
  },
  {
    id: "oxeye-daisy", name: "Oxeye Daisy", rarity: "rare",
    maxHealth: 4, baseDust: 5, maxStage: 6, epochsForHeal: 4, seedCost: 58,
    blurb: "Looks common. Isn't -- ask its dust yield.",
  },
  {
    id: "morning-glory", name: "Morning Glory", rarity: "rare",
    maxHealth: 3, baseDust: 5, maxStage: 6, epochsForHeal: 5, seedCost: 72,
    blurb: "Opens once a day, on your best behaviour only.",
  },
  // -- mythic: extraordinary, and almost impossible to nurse back --
  {
    id: "calla-lily", name: "Calla Lily", rarity: "mythic",
    maxHealth: 3, baseDust: 7, maxStage: 6, epochsForHeal: 5, seedCost: 130,
    blurb: "Elegant and thin-skinned. Two bad epochs undoes a season of care.",
  },
  {
    id: "heirloom-rose", name: "Heirloom Rose", rarity: "mythic",
    maxHealth: 3, baseDust: 8, maxStage: 7, epochsForHeal: 6, seedCost: 170,
    blurb: "Old stock, expensive stock. A thorn for every point of health it lacks.",
  },
  {
    id: "stargazer-lily", name: "Stargazer Lily", rarity: "mythic",
    maxHealth: 2, baseDust: 10, maxStage: 7, epochsForHeal: 6, seedCost: 220,
    blurb: "The rarest bloom in the garden, and the easiest to lose.",
  },
];

export const speciesById = (id: string) =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0];

/** The seed every farmer joins with. */
export const STARTING_SPECIES = "witchgrass";

/** Each stage adds this fraction of base dust. "Stats get slightly increased." */
export const STAGE_DUST_BONUS = 0.5;

export type Plant = {
  /** Tile it occupies, inside your own plot. */
  x: number;
  y: number;
  speciesId: string;
  health: number;
  stage: number;
  /** Consecutive healing epochs banked toward the next point of health. */
  healStreak: number;
  /** What this plant does on the NEXT epoch that gets enough water. */
  intent: "grow" | "heal";
};

export function newPlant(speciesId: string, x: number, y: number): Plant {
  const sp = speciesById(speciesId);
  return { x, y, speciesId, health: sp.maxHealth, stage: 0, healStreak: 0, intent: "grow" };
}

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
 * health maps onto them as a fraction of THIS species' max -- a stargazer
 * lily on 1 of 2 is in better shape than a witchgrass on 2 of 7, and should
 * look it.
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
