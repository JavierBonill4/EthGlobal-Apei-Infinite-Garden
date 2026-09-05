/**
 * Client-side mirrors of the contract's numbers.
 *
 * NOTHING HERE TOUCHES THE CHAIN. This is a local model so the world can be
 * walked around and felt before wallets are in the way -- but it is a mirror,
 * not an invention: every constant below is copied from Solidity and cited, so
 * that when `drawWater()` is wired up the feel does not change underneath the
 * player.
 *
 * If you change a number here, you have introduced a lie. Change it in the
 * contract and copy it back.
 */

/** contracts/src/Garden.sol:45 */
export const HEALTH_MAX = 1000;
/** contracts/src/Garden.sol:49-51 -- the requirement is rolled onto a bucket. */
export const REQ_MIN = 20;
export const REQ_MAX = 80;
export const REQ_STEP = 5;
/** contracts/src/libraries/Decay.sol:12 */
export const DECAY_NORMAL = 120;
/** contracts/src/libraries/WaterCurve.sol:18-22 */
export const SOFT_CAP = 100;
export const HARD_CAP = 250;
/** Deploy.s.sol season parameters. */
export const WELL_CAPACITY = 10_000;
export const WELL_REFILL = 800;

/**
 * contracts/src/libraries/WaterCurve.sol -- the asymmetry the whole game is
 * built on. The PLOT is credited on a curve that flattens; the WELL is always
 * debited the full raw amount. Past HARD_CAP you are burning the commons for
 * literally nothing.
 */
export function effective(amount: number): number {
  if (amount <= SOFT_CAP) return amount;
  if (amount <= HARD_CAP) return SOFT_CAP + Math.floor((amount - SOFT_CAP) / 2);
  return SOFT_CAP + Math.floor((HARD_CAP - SOFT_CAP) / 2);
}

export type Band = "thriving" | "steady" | "stressed" | "dying";

/** Mirrored in art/manifest.json healthBands and PlaceholderArt.sol. */
export function bandFor(health: number): Band {
  if (health >= 700) return "thriving";
  if (health >= 400) return "steady";
  if (health >= 150) return "stressed";
  return "dying";
}

/**
 * The number the HUD should lead with.
 *
 * Drawing REQ_MAX guarantees you meet whatever gets rolled, so anything you
 * did NOT draw up to that ceiling is restraint you chose. docs/DESIGN.md calls
 * this the headline figure and it is also what `WaterDrawn` carries on-chain
 * -- the ledger records what you left, not just what you took.
 */
export function forborne(drawnThisEpoch: number): number {
  return Math.max(0, REQ_MAX - drawnThisEpoch);
}

/** Uniform over {REQ_MIN, +STEP, ... REQ_MAX} -- bucket-aligned so the count is exact. */
export function rollRequirement(rand = Math.random): number {
  const buckets = (REQ_MAX - REQ_MIN) / REQ_STEP + 1;
  return REQ_MIN + Math.floor(rand() * buckets) * REQ_STEP;
}
