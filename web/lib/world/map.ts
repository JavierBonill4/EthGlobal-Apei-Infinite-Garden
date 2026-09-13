/**
 * HOME BASE, in the app.
 *
 * This is the same garden as
 * art/backgrounds/temp-home-garden/temp-home-garden-preview.html -- same size,
 * same layout, same two exits. They were different before, which is why
 * localhost did not look like the preview: the preview was never wired in.
 * Keep them in step, or pick one and delete the other.
 *
 * One source of truth: PLOTS produce their own fences AND the edges those
 * fences block, from the same rect. Two separate lists is how a demo ends up
 * walking through a fence.
 *
 * TODO(wiring): a fixture. Ownership and health come from the subgraph and
 * Garden.healthOf(). The SHAPE is the point: one contract plot is one walkable
 * 5x5 patch, and everything you do in here resolves to a single plotId.
 */
export const MAP_W = 14;
export const MAP_H = 11;

type Ground = "grass" | "grassWorn" | "path" | "soil" | "water";

export type Plot = {
  id: number;
  owner: string;
  mine: boolean;
  x0: number; y0: number; x1: number; y1: number;
  /** Which column is the gate, so the fence has a way in. */
  gateX: number;
  wilderness: boolean;
  /** 0..HEALTH_MAX. Local model only. */
  water: number;
};

/** Your patch is 5x5 -- most of the frame, with the camera following you. */
export const PLOTS: Plot[] = [
  { id: 1, owner: "you", mine: true,
    x0: 4, y0: 2, x1: 8, y1: 6, gateX: 6, wilderness: false, water: 760 },
];

export const MY_PLOT = PLOTS[0];

export const LANE_Y = 8;
/** The lane STOPS before the map edge. A road that runs off the screen
 *  promises it goes somewhere, and then an invisible wall says otherwise --
 *  which reads as the screen cutting you off rather than as the edge of a
 *  small garden. It now ends a tile past each signpost. */
export const LANE_X0 = 1;
export const LANE_X1 = 12;

export const WELL = { x: 9, y: LANE_Y };
export const TROUGH = { x: 8, y: 6 };
export const POND = { x0: 12, y0: 0, x1: 13, y1: 1 };

export type Exit = {
  x: number; y: number;
  /** Painted on the sign IN THE WORLD, always visible. A signpost that does
   *  not say where it goes is a post. */
  short: string;
  label: string;
  to: "woodland" | "gardenstate";
  /** A stone beside the post, so the two exits are not the same picture. */
  cairn: boolean;
};

/** Both ways out are roads with a signpost on them, and neither is on your
 *  plot: you leave home by walking off it. */
export const EXITS: Exit[] = [
  { x: 2, y: LANE_Y, short: "the woodland", cairn: false, to: "woodland",
    label: "Take the trail into the woodland" },
  { x: 11, y: LANE_Y, short: "the garden state", cairn: true, to: "gardenstate",
    label: "Climb to the overlook and read the garden" },
];

export const TREES = [
  { x: 1, y: 1 }, { x: 2, y: 5 }, { x: 12, y: 4 },
  { x: 13, y: 9 }, { x: 0, y: 10 }, { x: 11, y: 1 },
];
export const STONES = [{ x: 3, y: 10 }, { x: 10, y: 3 }, { x: 6, y: 10 }];

export function groundAt(x: number, y: number): Ground {
  if (x >= POND.x0 && x <= POND.x1 && y >= POND.y0 && y <= POND.y1) return "water";
  if (y === LANE_Y && x >= LANE_X0 && x <= LANE_X1) return "path";
  for (const p of PLOTS) {
    if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) {
      return p.wilderness ? "grass" : "soil";
    }
  }
  return (x * 7 + y * 13) % 5 === 0 ? "grassWorn" : "grass";
}

export function plotAt(x: number, y: number): Plot | null {
  for (const p of PLOTS) {
    if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) return p;
  }
  return null;
}

export type Fence = {
  kind: "fenceH" | "fenceV" | "fencePost";
  x: number; y: number; dx: number; dy: number;
};

export function fencesFor(p: Plot): { fences: Fence[]; blocked: Set<string> } {
  const fences: Fence[] = [];
  const blocked = new Set<string>();
  const edge = (x: number, y: number, side: "n" | "s" | "e" | "w") =>
    blocked.add(`${x},${y},${side}`);

  for (let x = p.x0; x <= p.x1; x++) {
    fences.push({ kind: "fenceH", x, y: p.y0, dx: 0, dy: -0.5 });
    edge(x, p.y0, "n"); edge(x, p.y0 - 1, "s");
    if (x !== p.gateX) {                       // the gate is a hole in both
      fences.push({ kind: "fenceH", x, y: p.y1, dx: 0, dy: 0.5 });
      edge(x, p.y1, "s"); edge(x, p.y1 + 1, "n");
    }
  }
  for (let y = p.y0; y <= p.y1; y++) {
    fences.push({ kind: "fenceV", x: p.x0, y, dx: -0.5, dy: 0 });
    edge(p.x0, y, "w"); edge(p.x0 - 1, y, "e");
    fences.push({ kind: "fenceV", x: p.x1, y, dx: 0.5, dy: 0 });
    edge(p.x1, y, "e"); edge(p.x1 + 1, y, "w");
  }
  fences.push({ kind: "fencePost", x: p.x0, y: p.y0, dx: -0.5, dy: -0.5 });
  fences.push({ kind: "fencePost", x: p.x1, y: p.y0, dx: 0.5, dy: -0.5 });
  return { fences, blocked };
}

const ALL_FENCES: Fence[] = [];
const BLOCKED_EDGES = new Set<string>();
for (const p of PLOTS) {
  if (p.wilderness) continue;   // nobody is keeping it, so nothing fences it
  const { fences, blocked } = fencesFor(p);
  ALL_FENCES.push(...fences);
  blocked.forEach((b) => BLOCKED_EDGES.add(b));
}
export { ALL_FENCES, BLOCKED_EDGES };

const SOLID = new Set<string>();
for (let y = POND.y0; y <= POND.y1; y++)
  for (let x = POND.x0; x <= POND.x1; x++) SOLID.add(`${x},${y}`);
TREES.forEach((t) => SOLID.add(`${t.x},${t.y}`));
STONES.forEach((s) => SOLID.add(`${s.x},${s.y}`));
SOLID.add(`${WELL.x},${WELL.y}`);
EXITS.forEach((e) => SOLID.add(`${e.x},${e.y}`));

/** Beds are walkable: you stand between the rows to tend them. */
export function solidAt(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return SOLID.has(`${x},${y}`);
}

export function edgeBlocked(x: number, y: number, side: "n" | "s" | "e" | "w"): boolean {
  return BLOCKED_EDGES.has(`${x},${y},${side}`);
}

/** Start just outside your own gate, facing your rows. */
export const PLAYER_START = { x: MY_PLOT.gateX + 0.5, y: MY_PLOT.y1 + 1.6 };
