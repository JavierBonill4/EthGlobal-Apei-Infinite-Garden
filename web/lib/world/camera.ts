/**
 * The camera, and the only place that knows how a world coordinate becomes a
 * screen coordinate.
 *
 * The constants come from art/manifest.json, not from here, because the ART is
 * drawn to them: every ground tile in art/world/ is 64x40 because tileW/tileH
 * says so. Change them here and the art is wrong; change them there and the
 * art is *still* wrong until it is redrawn. They live in the manifest so there
 * is exactly one number to argue about. See art/ART.md "The camera".
 *
 * This is an axis-aligned grid under a pitched camera -- NOT isometric. The
 * grid is never rotated. A tile is a rectangle. tileH/tileW = 0.625 is the
 * entire projection; there is no matrix.
 */
import manifest from "../../../art/manifest.json";

export const TILE_W = manifest.world.camera.tileW;
export const TILE_H = manifest.world.camera.tileH;

/** Standing sprites: the point in their own viewBox that meets the ground. */
export type Standing = { file: string; anchor: number[]; size: number[] };

export const ART = {
  ground: manifest.world.ground as Record<string, string>,
  beds: manifest.world.beds as unknown as Record<string, Standing>,
  props: manifest.world.props as unknown as Record<string, Standing>,
  portal: manifest.world.portal as unknown as Standing,
  avatar: manifest.world.avatar as unknown as Record<string, Standing>,
};

/** Assets are served from web/public/art, which is a symlink to art/. */
export const url = (p: string) => `/art/${p}`;

/** Ground centre of tile (x, y), in world pixels. */
export function tileCentre(x: number, y: number) {
  return { px: (x + 0.5) * TILE_W, py: (y + 0.5) * TILE_H };
}

/**
 * Where a standing sprite's top-left goes so that its anchor lands on a point.
 * Getting this wrong is the difference between an object standing on the
 * ground and hovering above it -- art/WORLDVIEW.html exists to catch exactly
 * that, with its Anchors toggle.
 */
export function place(s: Standing, px: number, py: number) {
  return {
    left: px - s.anchor[0],
    top: py - s.anchor[1],
    width: s.size[0],
    height: s.size[1],
  };
}

/**
 * Painter's order. Depth in this camera is ONLY occlusion -- a player behind a
 * tree has to be hidden by it or the ground plane reads as a floor with
 * stickers on it. z-index from world y does the sort for free, without
 * re-sorting a list every frame.
 */
export const depth = (worldY: number) => Math.round(worldY * 100) + 1000;
