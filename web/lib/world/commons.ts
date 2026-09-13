/**
 * The commons, sized by how many people are actually tending.
 *
 * Everything shared in this game -- the well and the commune's target -- used
 * to be a fixed number chosen for a world with one gardener in it. Fixed
 * numbers break in both directions: a well sized for fifty is infinite to
 * five, and a commune goal sized for five is unreachable by fifty.
 *
 * So both scale with ACTIVE PATCHES: a patch with at least one living plant.
 * Not signups, not addresses -- a patch with something alive in it. Somebody
 * who joined and let everything die is not drawing from the well and is not
 * feeding the commune, and the commons should not be sized as though they
 * were. It is the same rule the fog frontier uses, for the same reason.
 */
import { REQ_MAX, REQ_MIN, REQ_STEP } from "./mechanics";

/**
 * THE NUMBER THE WHOLE DIFFICULTY RESTS ON.
 *
 * The well refills this much per active patch per epoch, so in a steady state
 * -- where the well neither fills nor drains -- the average patch can draw
 * exactly this much. It is the average allowance, in one constant.
 *
 * It is 150 because a Clover needs the BASE roll, the base averages 50, and
 * three Clovers is the sustainable patch:
 *
 *   3 clover x 50 mean need  =  150  =  refill      -> exactly 50/50
 *
 * So a patch of three Clovers is break-even against the well and nothing
 * richer is. Plant a Moonflower (2-3x thirst) and you are over the line the
 * moment you add anything beside it. That ceiling is deliberate and it is
 * where the second well, rain and water items are meant to go.
 *
 *   draw your fair share   -> you meet the requirement about half the time
 *   draw enough to be safe -> you are taking more than your share, every epoch
 *
 * That is the tragedy stated as arithmetic rather than as a theme. Raising
 * this is the single most effective way to make the game kinder; lowering it
 * is the most effective way to make it vicious.
 */
export const REFILL_PER_PATCH = 150;

/**
 * Buffer, in epochs of refill. Four.
 *
 * The buffer is what a panic eats. With everyone drawing the cap (80) against
 * a 50 refill, the well loses 30 per patch per epoch, so a full well survives
 * roughly 200/30 ~ 7 epochs of total panic. At 24h epochs that is a week --
 * long enough that a bank run is a thing you watch coming and can still talk
 * each other out of, short enough that talking is urgent.
 *
 * Set it to 1 and a single bad epoch is terminal, which removes the politics.
 * Set it to 20 and nothing anyone does matters for a month.
 */
export const CAPACITY_PER_PATCH = REFILL_PER_PATCH * 4;

/**
 * The most one patch may draw in one epoch: enough to be CERTAIN that
 * everything it has planted is watered, whatever base gets rolled.
 *
 * It scales with what you planted rather than being a flat number, and the
 * ratio falls out the same either way:
 *
 *   3 clover: certain = 80 x 3.0 = 240, against a 150 share = 1.6x
 *
 * Certainty is therefore always purchasable and always costs 1.6x your share,
 * no matter what is in the ground. Planting more does not change the price of
 * safety, it changes how much safety costs in absolute water -- which is the
 * honest way round.
 */
export function drawCap(totalMultiplier: number) {
  return Math.round(REQ_MAX * totalMultiplier);
}

/** Mean of the uniform roll over {REQ_MIN..REQ_MAX} in REQ_STEP buckets. */
export const MEAN_REQUIREMENT = (REQ_MIN + REQ_MAX) / 2;

/** Ether dust the commune asks of each active patch, per cycle. */
export const COMMUNE_GOAL_PER_PATCH = 25;

/** Each time the bar fills, the next one asks this much more. */
export const COMMUNE_GROWTH = 1.2;

/** A patch counts if something is alive in it. */
export const isActive = (livingPlants: number) => livingPlants > 0;

/** Never divide by a world with nobody in it. */
export const clampPatches = (n: number) => Math.max(1, Math.round(n));

export function wellCapacity(activePatches: number) {
  return clampPatches(activePatches) * CAPACITY_PER_PATCH;
}
export function wellRefill(activePatches: number) {
  return clampPatches(activePatches) * REFILL_PER_PATCH;
}

/**
 * The commune's target. Scales with the people in it, and grows each time it
 * is reached -- so a bigger garden is asked for more, and a garden that keeps
 * succeeding is asked for more again.
 */
export function communeGoal(activePatches: number, cycles: number) {
  const base = clampPatches(activePatches) * COMMUNE_GOAL_PER_PATCH;
  return Math.round(base * Math.pow(COMMUNE_GROWTH, cycles));
}

/**
 * What share of the well one patch is entitled to this epoch, if everyone took
 * equally. Shown to the player, because the interesting decision is whether to
 * exceed it -- and a number you cannot see is not a decision, it is an
 * accident.
 */
export function fairShare(activePatches: number, wellLevel: number) {
  const n = clampPatches(activePatches);
  // You cannot take a share of water that is not there.
  return Math.max(0, Math.min(REFILL_PER_PATCH, Math.floor(wellLevel / n)));
}

/**
 * What this patch would need, on an average roll, to water everything in it.
 *
 * If this exceeds the fair share, the patch is planted beyond what the commons
 * can carry -- which is allowed, and is exactly the pressure rare plants are
 * supposed to create. The player should be able to see it, not deduce it.
 */
export function meanNeed(totalMultiplier: number) {
  return Math.round(MEAN_REQUIREMENT * totalMultiplier);
}
