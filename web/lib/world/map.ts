/**
 * The world, as data.
 *
 * One source of truth: PLOTS produce their own fences, their own blocked edges
 * and their own bed tiles, so the thing you can see and the thing you can walk
 * through cannot disagree. Every time those are two separate lists somebody
 * ends up walking through a fence in a demo.
 *
 * TODO(wiring): this is a fixture. Plot ownership, health and the wilderness
 * flag all come from the subgraph and Garden.healthOf() -- see
 * web/lib/queries.ts. The SHAPE is what matters here: one contract plot is one
 * walkable 3x3 patch, which is the Patch band in docs/DESIGN.md.
 */
export const MAP_W = 16;
export const MAP_H = 12;

type Ground = "grass" | "grassWorn" | "path" | "soil" | "water";

export type Plot = {
  id: number;
  owner: string;
  mine: boolean;
  /** Inclusive tile bounds of the walkable patch. */
  x0: number; y0: number; x1: number; y1: number;
  /** Which edge is the gate, so the fence has a way in. */
  gateX: number;
  wilderness: boolean;
  /** 0..HEALTH_MAX. Local model only -- see mechanics.ts. */
  water: number;
};

export const PLOTS: Plot[] = [
  { id: 1, owner: "you",       mine: true,  x0: 3, y0: 2, x1: 5, y1: 4, gateX: 4, wilderness: false, water: 760 },
  { id: 2, owner: "mira.eth",  mine: false, x0: 10, y0: 2, x1: 12, y1: 4, gateX: 11, wilderness: false, water: 430 },
  { id: 3, owner: "0xtunde",   mine: false, x0: 10, y0: 8, x1: 12, y1: 10, gateX: 11, wilderness: false, water: 180 },
  { id: 4, owner: "—",         mine: false, x0: 3, y0: 8, x1: 5, y1: 10, gateX: 4, wilderness: true,  water: 0 },
];

export const MY_PLOT = PLOTS.find((p) => p.mine)!;

/** Lane tiles: one row and one column of path, meeting at a crossroads. */
const LANE_Y = 6;
const LANE_X = 8;

export const WELL = { x: 7, y: 7 };
export const TROUGH = { x: 5, y: 4 };

/** Portals sit ON the lane, never on a plot. Nobody's portal, like the well. */
export const PORTALS = [
  { x: 1, y: LANE_Y, challenge: "connect" as const },
  { x: 14, y: LANE_Y, challenge: "tilt" as const },
];

export const TREES = [
  { x: 0, y: 2 }, { x: 1, y: 9 }, { x: 15, y: 3 },
  { x: 6, y: 9 }, { x: 14, y: 10 }, { x: 0, y: 4 },
];
export const STONES = [{ x: 7, y: 4 }, { x: 13, y: 6 }, { x: 2, y: 11 }, { x: 9, y: 11 }];
export const SIGNPOST = { x: 6, y: 5 };
export const POND = { x0: 0, y0: 0, x1: 1, y1: 1 };

export function groundAt(x: number, y: number): Ground {
  if (x >= POND.x0 && x <= POND.x1 && y >= POND.y0 && y <= POND.y1) return "water";
  if (y === LANE_Y || x === LANE_X) return "path";
  for (const p of PLOTS) {
    if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) {
      // Wilderness has gone back to grass. That IS the story -- art/ART.md.
      return p.wilderness ? "grass" : "soil";
    }
  }
  // Deterministic scatter so the field does not read as wallpaper.
  return (x * 7 + y * 13) % 5 === 0 ? "grassWorn" : "grass";
}

export function plotAt(x: number, y: number): Plot | null {
  for (const p of PLOTS) {
    if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) return p;
  }
  return null;
}

/** A fence segment to draw. `kind` picks the sprite; dx/dy nudge it to the edge. */
export type Fence = { kind: "fenceH" | "fenceV" | "fencePost"; x: number; y: number; dx: number; dy: number };

/**
 * Fences AND the edges they block, derived together from the plot rect so the
 * two can never drift apart. The gate is a hole in both at once.
 */
export function fencesFor(p: Plot): { fences: Fence[]; blocked: Set<string> } {
  const fences: Fence[] = [];
  const blocked = new Set<string>();
  const edge = (x: number, y: number, side: "n" | "s" | "e" | "w") => blocked.add(`${x},${y},${side}`);

  for (let x = p.x0; x <= p.x1; x++) {
    fences.push({ kind: "fenceH", x, y: p.y0, dx: 0, dy: -0.5 });
    edge(x, p.y0, "n"); edge(x, p.y0 - 1, "s");
    if (x !== p.gateX) {
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
  // Wilderness is unfenced, and that is the clearest thing on the map. A fence
  // says someone is keeping this; a reverted plot has nobody keeping it, so the
  // boundary goes with the owner. It also means you can walk straight in --
  // which is what claimWilderness() is for.
  if (p.wilderness) continue;
  const { fences, blocked } = fencesFor(p);
  ALL_FENCES.push(...fences);
  blocked.forEach((b) => BLOCKED_EDGES.add(b));
}
export { ALL_FENCES, BLOCKED_EDGES };

const SOLID = new Set<string>();
for (let y = POND.y0; y <= POND.y1; y++) for (let x = POND.x0; x <= POND.x1; x++) SOLID.add(`${x},${y}`);
TREES.forEach((t) => SOLID.add(`${t.x},${t.y}`));
STONES.forEach((s) => SOLID.add(`${s.x},${s.y}`));
SOLID.add(`${WELL.x},${WELL.y}`);
SOLID.add(`${SIGNPOST.x},${SIGNPOST.y}`);

/** Beds are walkable: you stand between the rows to tend them. */
export function solidAt(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return SOLID.has(`${x},${y}`);
}

export function edgeBlocked(x: number, y: number, side: "n" | "s" | "e" | "w"): boolean {
  return BLOCKED_EDGES.has(`${x},${y},${side}`);
}

export const PLAYER_START = { x: 4.5, y: 5.5 };
