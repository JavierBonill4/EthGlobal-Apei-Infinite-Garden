"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BIOME_ORDER, TENDED_PLOTS, frontierRadius, generateWorld, isGrown,
  legendaries, type World,
} from "../../lib/world/worldgen";
import type { Garden } from "../../lib/world/useGarden";

/**
 * WORLD VIEW -- "how is the world?"
 *
 * Canvas, not DOM, and that is a spec rather than an optimisation. One <img>
 * per plot dies somewhere around two thousand nodes, long before the world is
 * interesting; this blits 16,384 cells in one pass and scales by changing
 * WORLD_N. The consequence to accept up front: World CANNOT show detail, ever.
 * Detail is what the Patch view is for.
 *
 * The other rule from docs/VIEWS-AND-ECONOMY.md: no numbers. If the world's
 * health needs a readout, the colour has failed. Everything here is colour,
 * fog and the absence of creatures.
 */

/* Band colours, watercolour register. Thriving is not "good green", it is a
   full wash; dying is not red, it is drained. Health reads as saturation
   falling, which survives being 3px wide. */
const BAND_FILL = ["#7DB66C", "#A3C47A", "#D2BE6A", "#B08A63", "#B8C79B"];
const BIOME_FILL: Record<string, string> = {
  ocean: "#7FB4C4", shore: "#E2D8B4", lake: "#A8D3DC", meadow: "#C9DD97",
  forest: "#7DB66C", wet: "#9CC4A6", frost: "#DCE8E4", high: "#BFB79F",
};
const PAPER = "#EDF2DC";
const FOG = "#E8EEDA";

export function WorldView({ garden, onEnterPatch }: { garden: Garden; onEnterPatch: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const world = useMemo<World>(() => generateWorld(), []);
  const [zoom, setZoom] = useState(7);
  const cam = useRef({ x: world.origin.x, y: world.origin.y });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  /** The frontier answers to tended plots, so it moves with the population.
   *  Your own garden's health nudges it, which is the point of showing it. */
  const radius = frontierRadius(TENDED_PLOTS) * (0.9 + 0.2 * (garden.mine.water / 1000));
  const motes = useMemo(() => legendaries(world, radius), [world, radius]);

  /* ---- bake the terrain once; it only changes when the frontier moves ---- */
  const baked = useRef<HTMLCanvasElement | null>(null);
  const bakedFor = useRef(-1);
  const bake = useCallback(() => {
    const n = world.n;
    const c = baked.current ?? document.createElement("canvas");
    c.width = n; c.height = n;
    baked.current = c;
    const g = c.getContext("2d")!;
    const img = g.createImageData(n, n);
    const px = img.data;
    const hex = (h: string) => [
      parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
    ];
    const bandRgb = BAND_FILL.map(hex);
    const biomeRgb = BIOME_ORDER.map((b) => hex(BIOME_FILL[b]));
    const fogRgb = hex(FOG);

    for (let k = 0; k < n * n; k++) {
      let rgb: number[];
      if (isGrown(world, k, radius)) {
        rgb = bandRgb[world.band[k]];
      } else {
        // Ungrown ground is drawn in fog that THINS toward the frontier, so the
        // biome under it stays faintly legible -- you can tell there is
        // coastline out west and you cannot tell what is on it. That is what
        // gives the community something to argue about spending Expansion on.
        const over = world.dist[k] - radius;
        const t = Math.min(0.86, 0.3 + over / 26);
        const b = biomeRgb[world.biome[k]];
        rgb = [
          b[0] * (1 - t) + fogRgb[0] * t,
          b[1] * (1 - t) + fogRgb[1] * t,
          b[2] * (1 - t) + fogRgb[2] * t,
        ];
      }
      const o = k * 4;
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    bakedFor.current = radius;
  }, [world, radius]);

  const draw = useCallback(() => {
    const cv = canvas.current, host = wrap.current;
    if (!cv || !host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = host.clientWidth, vh = host.clientHeight;
    if (cv.width !== Math.round(vw * dpr)) {
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    }
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(0, 0, vw, vh);
    if (bakedFor.current !== radius) bake();

    const z = zoom;
    const ox = vw / 2 - cam.current.x * z;
    const oy = vh / 2 - cam.current.y * z;
    g.imageSmoothingEnabled = z < 3;
    g.drawImage(baked.current!, ox, oy, world.n * z, world.n * z);

    // Your own sector, and your own plot. The only two things labelled.
    const sx = ox + world.mine.x * z, sy = oy + world.mine.y * z;
    g.strokeStyle = "rgba(38,56,58,.5)";
    g.lineWidth = 1.5;
    g.strokeRect(ox + (world.mine.x - 4.5) * z, oy + (world.mine.y - 4.5) * z, 10 * z, 10 * z);
    g.strokeStyle = "#2F7E72";
    g.lineWidth = 2.5;
    g.strokeRect(sx - z * 0.5, sy - z * 0.5, z * 2, z * 2);

    // Legendary sightings as motes of light. Visible from anywhere, which is
    // what makes a mythical arrival a public occasion rather than a private
    // screenshot -- and what lets you watch the map go dark.
    const t = performance.now() * 0.002;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const mx = ox + m.x * z, my = oy + m.y * z;
      const pulse = 0.55 + 0.45 * Math.sin(t + i * 2.1);
      const r = (7 + 13 * pulse) * Math.max(0.6, z / 4);
      const grd = g.createRadialGradient(mx, my, 0, mx, my, r);
      grd.addColorStop(0, "rgba(255,252,236,.95)");
      grd.addColorStop(0.3, "rgba(212,168,70,.75)");
      grd.addColorStop(1, "rgba(212,168,70,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
    }
  }, [bake, motes, radius, world, zoom]);

  useEffect(() => {
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); draw(); };
    raf = requestAnimationFrame(loop);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [draw]);

  /* ---- pan, zoom, and one click target ---------------------------------- */
  const cellAt = useCallback((clientX: number, clientY: number) => {
    const host = wrap.current!;
    const r = host.getBoundingClientRect();
    const vw = r.width, vh = r.height;
    const x = Math.floor((clientX - r.left - (vw / 2 - cam.current.x * zoom)) / zoom);
    const y = Math.floor((clientY - r.top - (vh / 2 - cam.current.y * zoom)) / zoom);
    return { x, y };
  }, [zoom]);

  return (
    <div className="ig-worldview" ref={wrap}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const d = drag.current; drag.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
        const c = cellAt(e.clientX, e.clientY);
        if (Math.abs(c.x - world.mine.x) <= 4 && Math.abs(c.y - world.mine.y) <= 4) onEnterPatch();
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          cam.current.x -= (e.clientX - drag.current.x) / zoom;
          cam.current.y -= (e.clientY - drag.current.y) / zoom;
          drag.current = { x: e.clientX, y: e.clientY };
          return;
        }
        const c = cellAt(e.clientX, e.clientY);
        const k = c.y * world.n + c.x;
        if (c.x < 0 || c.y < 0 || c.x >= world.n || c.y >= world.n) { setHover(null); return; }
        const near = Math.abs(c.x - world.mine.x) <= 4 && Math.abs(c.y - world.mine.y) <= 4;
        setHover(near ? "your neighbourhood — click to walk in"
          : isGrown(world, k, radius) ? "tended" : "not grown yet");
      }}
      onWheel={(e) => {
        e.preventDefault();
        setZoom((z) => Math.max(1.2, Math.min(14, z * Math.exp(-e.deltaY * 0.0015))));
      }}
    >
      <canvas ref={canvas} />
      <div className="ig-wv-legend">
        <span className="ig-label">The world</span>
        <ul>
          {["thriving", "steady", "stressed", "dying", "wilderness"].map((n, i) => (
            <li key={n}><i style={{ background: BAND_FILL[i] }} />{n}</li>
          ))}
          <li><i style={{ background: FOG }} />not grown yet</li>
        </ul>
        <p>
          Fog tracks <b>tended</b> plots, not signups. People quitting pulls the
          coastline in.
        </p>
      </div>
      {hover && <div className="ig-wv-hover">{hover}</div>}
      <div className="ig-help">drag to pan · scroll to zoom · click your neighbourhood</div>
    </div>
  );
}
