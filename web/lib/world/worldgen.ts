/**
 * The world, generated.
 *
 * "Prepare as if it will be big" means the World view cannot be a hand-written
 * array and cannot be one DOM node per plot. This produces a flat typed-array
 * world that a canvas can blit in one pass, and it scales by changing N.
 *
 * Two noise fields (land, elevation) plus a temperature ramp -- no hand-placed
 * terrain, so a season can be reseeded without an artist touching anything.
 * Same shape as the atlas mockup in the design docs, on purpose: the two views
 * should be looking at the same world.
 */

/** 128x128 = 16,384 plots. Raise it; the renderer does not care. */
export const WORLD_N = 128;

export type Biome = "ocean" | "shore" | "lake" | "meadow" | "forest" | "wet" | "frost" | "high";

export const BIOME_ORDER: Biome[] = [
  "ocean", "shore", "lake", "meadow", "forest", "wet", "frost", "high",
];

/* ---- noise -------------------------------------------------------------- */
function hash2(x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695040);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x: number, y: number, s: number) {
  let t = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) { t += vnoise(x * f, y * f, s + o * 17) * amp; amp *= 0.5; f *= 2; }
  return t / 0.9375;
}

export type World = {
  n: number;
  /** Biome index into BIOME_ORDER. */
  biome: Uint8Array;
  /** 0 ocean/unplottable, 1 plottable land. */
  land: Uint8Array;
  /** Distance from the garden's origin, for the fog frontier. */
  dist: Float32Array;
  /** Health band 0..3 (thriving..dying), 4 = wilderness. Fixture data. */
  band: Uint8Array;
  /** Whether a plot is tended at all. Drives the frontier. */
  tended: Uint8Array;
  origin: { x: number; y: number };
  mine: { x: number; y: number };
};

/** Where the garden started. Everything grows out from here. */
const ORIGIN = { x: 62, y: 66 };

export function generateWorld(n = WORLD_N, seed = 11): World {
  const biome = new Uint8Array(n * n);
  const land = new Uint8Array(n * n);
  const dist = new Float32Array(n * n);
  const band = new Uint8Array(n * n);
  const tended = new Uint8Array(n * n);
  const bi = (b: Biome) => BIOME_ORDER.indexOf(b);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const nx = i / n, ny = j / n;
      const cont = fbm(nx * 3.3 + 5, ny * 3.3 + 5, seed);
      const dc = Math.hypot((i - ORIGIN.x) / (n * 0.62), (j - ORIGIN.y) / (n * 0.62));
      const l = cont * 0.66 + (1 - dc) * 0.74;
      const elev = fbm(nx * 3.6 + 21, ny * 3.6 + 21, seed + 26);
      const moist = fbm(nx * 4.4 + 61, ny * 4.4 + 61, seed + 42);
      const temp = (i + j) / (2 * n) + fbm(nx * 2 + 90, ny * 2 + 90, seed + 60) * 0.22 - 0.04;

      let b: Biome;
      if (l < 0.52) b = "ocean";
      else if (l < 0.56) b = "shore";
      else if (elev > 0.632) b = "high";
      else if (temp < 0.335) b = "frost";
      else if (moist > 0.745) b = "lake";
      else if (moist > 0.632) b = "wet";
      else if (moist > 0.515) b = "forest";
      else b = "meadow";

      biome[k] = bi(b);
      land[k] = b === "ocean" || b === "lake" ? 0 : 1;
      dist[k] = Math.hypot(i - ORIGIN.x, j - ORIGIN.y) + fbm(i * 0.13, j * 0.13, seed + 7) * 9 - 4.5;

      // Fixture health. TODO(wiring): this is the subgraph's job -- one query
      // per epoch for the whole world, cached, never per plot.
      //
      // SMOOTH, not per-cell random. Health in this game is spatially
      // correlated: neighbours share a well and an adjacency bonus, so
      // neighbourhoods thrive or fail together. A per-cell hash renders as TV
      // static at one pixel per plot -- no regions, no story, nothing to read.
      const hs = fbm(nx * 7.5 + 200, ny * 7.5 + 200, seed + 91);
      const grain = hash2(i, j, 999) * 0.12;
      const h = Math.min(1, Math.max(0, hs * 0.88 + grain));
      tended[k] = land[k] && h > 0.24 ? 1 : 0;
      band[k] = !tended[k] ? 4 : h > 0.66 ? 0 : h > 0.5 ? 1 : h > 0.36 ? 2 : 3;
    }
  }
  const k0 = ORIGIN.y * n + ORIGIN.x;
  biome[k0] = bi("meadow"); land[k0] = 1; tended[k0] = 1; band[k0] = 0; dist[k0] = 0;
  return { n, biome, land, dist, band, tended, origin: ORIGIN, mine: { ...ORIGIN } };
}

/**
 * The fog frontier, in tiles from the origin.
 *
 * It tracks TENDED plots, not signups -- so a wave of people quitting visibly
 * pulls the coastline back in, and losing ground is a thing you watch happen.
 * That is the whole reason fog is a resource in this game rather than a
 * curtain over unexplored map.
 */
export function frontierRadius(tendedPlots: number) {
  return 6 + Math.sqrt(Math.max(0, tendedPlots)) * 0.62;
}

/**
 * How many plots the cohort is actually tending. This is a GAME-STATE number,
 * not a property of the terrain -- and it is the whole reason fog is a
 * resource here rather than a curtain over unexplored map.
 *
 * TODO(wiring): Garden.season().activePlots, summed across sectors.
 *
 * Do NOT feed the count of tended CELLS back in. Every land cell in a 128x128
 * world is "tended" in the fixture, which put the frontier past the coastline
 * and left nothing ungrown -- so the fog, and the thing the Expansion vote is
 * about, both disappeared.
 */
export const TENDED_PLOTS = 1204;

export function countTended(w: World) {
  let n = 0;
  for (let k = 0; k < w.tended.length; k++) if (w.tended[k]) n++;
  return n;
}

export function isGrown(w: World, k: number, radius: number) {
  return w.land[k] === 1 && w.dist[k] < radius;
}

/** Legendary sightings. Visible world-wide by design: an arrival is a public
 *  event, which is what makes "the herons have gone" mean something. */
export function legendaries(w: World, radius: number) {
  const out: { x: number; y: number; kind: string }[] = [];
  const kinds = ["turtleduck", "unicorn", "armatiger"];
  let seen = 0;
  for (let a = 0; a < 3; a++) {
    const ang = hash2(a, 7, 31) * Math.PI * 2;
    const r = radius * (0.45 + hash2(a, 9, 33) * 0.5);
    const x = Math.round(w.origin.x + Math.cos(ang) * r);
    const y = Math.round(w.origin.y + Math.sin(ang) * r);
    if (x < 0 || y < 0 || x >= w.n || y >= w.n) continue;
    if (!w.land[y * w.n + x]) continue;
    out.push({ x, y, kind: kinds[seen++ % kinds.length] });
  }
  return out;
}
