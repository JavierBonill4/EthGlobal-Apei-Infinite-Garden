"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ART, TILE_H, TILE_W, depth, place, tileCentre, url,
} from "../../lib/world/camera";
import {
  ALL_FENCES, EXITS, MAP_H, MAP_W, STONES, TREES,
  TROUGH, WELL, PLAYER_START, edgeBlocked, groundAt, plotAt, solidAt,
  type Exit,
} from "../../lib/world/map";
import { bandFor } from "../../lib/world/mechanics";
import type { Garden } from "../../lib/world/useGarden";

const SCALE = 2;            // world pixels -> screen pixels
const SPEED = 3.4;          // world px per frame at 60fps (~3 tiles/sec)
const RADIUS = 0.22;        // player half-width, in tiles

type Facing = "n" | "s" | "e" | "w";
export type Target =
  | { kind: "water"; label: string }
  | { kind: "well"; label: string }
  | { kind: "exit"; label: string; exit: Exit }
  | null;

/** Solid tile, or a fence on the edge we are crossing. Axis-separated so
 *  sliding along a fence feels right instead of sticking. */
function passable(fromX: number, fromY: number, toX: number, toY: number) {
  const ft = { x: Math.floor(fromX), y: Math.floor(fromY) };
  const tt = { x: Math.floor(toX), y: Math.floor(toY) };
  if (ft.x === tt.x && ft.y === tt.y) return true;
  if (solidAt(tt.x, tt.y)) return false;
  if (tt.x !== ft.x) return !edgeBlocked(ft.x, ft.y, tt.x > ft.x ? "e" : "w");
  return !edgeBlocked(ft.x, ft.y, tt.y > ft.y ? "s" : "n");
}

export function Overworld({
  garden,
  onLeave,
  onViewGardenState,
  frozen,
}: {
  garden: Garden;
  /** Walk out to the woodland. Not a portal: a road. */
  onLeave: () => void;
  /** The overlook. Opens the standalone Garden State preview. */
  onViewGardenState: () => void;
  frozen: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLImageElement>(null);
  const pos = useRef({ ...PLAYER_START });
  const face = useRef<Facing>("s");
  const keys = useRef<Record<string, boolean>>({});
  const [target, setTarget] = useState<Target>(null);
  const [note, setNote] = useState<string | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  /* ---- what is the player standing at ---- */
  const targetAt = useCallback((x: number, y: number): Target => {
    const near = (a: { x: number; y: number }, r = 1.15) =>
      Math.hypot(a.x + 0.5 - x, a.y + 0.5 - y) < r;
    // Generous radius on purpose. A signpost is solid, so you stand BESIDE it,
    // and you usually approach along the row under the lane rather than the
    // lane itself. At a tight radius you end up shuffling about hunting for
    // the trigger, which reads as a broken signpost rather than a hidden one.
    for (const e of EXITS) {
      if (near(e, 1.8)) return { kind: "exit", label: e.label, exit: e };
    }
    if (near(WELL, 1.3)) return { kind: "well", label: "Read the well" };
    const plot = plotAt(Math.floor(x), Math.floor(y));
    if (plot?.mine) return { kind: "water", label: "Water this row" };
    return null;
  }, []);

  /* ---- the loop ---- */
  useEffect(() => {
    let raf = 0;
    let last: Target = null;
    const step = () => {
      raf = requestAnimationFrame(step);
      const k = keys.current;
      let dx = 0, dy = 0;
      if (!frozenRef.current) {
        if (k["ArrowUp"] || k["w"]) dy -= 1;
        if (k["ArrowDown"] || k["s"]) dy += 1;
        if (k["ArrowLeft"] || k["a"]) dx -= 1;
        if (k["ArrowRight"] || k["d"]) dx += 1;
      }
      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        // Facing follows the dominant axis: a sprite that flickers between two
        // facings on a diagonal reads as broken, not as detail.
        face.current = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : dy > 0 ? "s" : "n";
        const stepX = (dx / m) * (SPEED / TILE_W);
        const stepY = (dy / m) * (SPEED / TILE_H);
        const p = pos.current;
        const nx = p.x + stepX;
        if (passable(p.x, p.y, nx + Math.sign(stepX) * RADIUS, p.y)) p.x = nx;
        const ny = p.y + stepY;
        if (passable(p.x, p.y, p.x, ny + Math.sign(stepY) * RADIUS)) p.y = ny;
        p.x = Math.max(RADIUS, Math.min(MAP_W - RADIUS, p.x));
        p.y = Math.max(RADIUS, Math.min(MAP_H - RADIUS, p.y));
      }

      const p = pos.current;
      const spec = ART.avatar[face.current];
      const c = { px: p.x * TILE_W, py: p.y * TILE_H };
      const box = place(spec, c.px, c.py);
      if (avatar.current) {
        avatar.current.src = url(spec.file);
        avatar.current.style.transform = `translate(${box.left}px, ${box.top}px)`;
        avatar.current.style.zIndex = String(depth(p.y));
      }
      // Camera. Centre on the player, then clamp so the world never shows void.
      if (world.current && viewport.current) {
        const vw = viewport.current.clientWidth / SCALE;
        const vh = viewport.current.clientHeight / SCALE;
        const cx = Math.min(Math.max(c.px - vw / 2, 0), Math.max(0, MAP_W * TILE_W - vw));
        const cy = Math.min(Math.max(c.py - vh / 2, 0), Math.max(0, MAP_H * TILE_H - vh));
        world.current.style.transform = `scale(${SCALE}) translate(${-cx}px, ${-cy}px)`;
      }
      const t = targetAt(p.x, p.y);
      if (t?.kind !== last?.kind) { setTarget(t); last = t; }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetAt]);

  /* ---- input ---- */
  const act = useCallback(() => {
    const t = targetAt(pos.current.x, pos.current.y);
    if (!t) return;
    if (t.kind === "exit") {
      if (t.exit.to === "woodland") onLeave();
      else onViewGardenState();
      return;
    }
    if (t.kind === "well") {
      setNote(`The well holds ${Math.round(garden.well).toLocaleString()} units. Everyone draws from this one.`);
      window.setTimeout(() => setNote(null), 3200);
      return;
    }
    const err = garden.water();
    if (err) { setNote(err); window.setTimeout(() => setNote(null), 2400); }
  }, [garden, onLeave, onViewGardenState, targetAt]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keys.current[key] = true;
      if ((e.key === " " || key === "e") && !frozenRef.current) act();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
    };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [act]);

  /* ---- ground: never changes, so build it once ---- */
  const ground = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        out.push(
          <img key={`g${x},${y}`} src={url(ART.ground[groundAt(x, y)])} alt=""
            style={{ left: x * TILE_W, top: y * TILE_H, width: TILE_W, height: TILE_H, zIndex: 0 }} />,
        );
      }
    }
    return out;
  }, []);

  /* ---- scenery: also static ---- */
  const scenery = useMemo(() => {
    const out: React.ReactNode[] = [];
    const put = (key: string, spec: typeof ART.portal, x: number, y: number, dx = 0, dy = 0) => {
      const c = tileCentre(x + dx, y + dy);
      const b = place(spec, c.px, c.py);
      out.push(
        <img key={key} src={url(spec.file)} alt=""
          style={{ ...b, zIndex: depth(y + dy + 0.5) }} />,
      );
    };
    ALL_FENCES.forEach((f, i) => put(`f${i}`, ART.props[f.kind], f.x, f.y, f.dx, f.dy));
    TREES.forEach((t, i) => put(`t${i}`, ART.props.tree, t.x, t.y));
    STONES.forEach((s, i) => put(`s${i}`, ART.props.stone, s.x, s.y));
    put("well", ART.props.well, WELL.x, WELL.y);
    put("trough", ART.props.trough, TROUGH.x, TROUGH.y, 0, 0.2);
    EXITS.forEach((e, i) => {
      // A stone beside the overlook post, so the two exits are not the same
      // picture. No new art -- prop-stone.svg, nudged off the post.
      if (e.cairn) put(`cairn${i}`, ART.props.stone, e.x, e.y, 0.34, 0.18);
      put(`exit${i}`, ART.props.signpost, e.x, e.y);
    });
    EXITS.forEach((e, i) => {
      const c = tileCentre(e.x, e.y);
      out.push(
        <span key={`sign${i}`} className="ig-signtag"
          style={{ left: c.px, top: c.py - 66, zIndex: depth(e.y + 0.5) + 1 }}>
          {e.short}
        </span>,
      );
    });
    return out;
  }, []);

  /* ---- beds: the only layer that redraws, because it is the dashboard ---- */
  const beds = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (const plot of garden.plots) {
      const key = plot.wilderness ? "wilderness" : bandFor(plot.water);
      const spec = ART.beds[key];
      for (let y = plot.y0; y <= plot.y1; y++) {
        for (let x = plot.x0; x <= plot.x1; x++) {
          const c = tileCentre(x, y);
          const b = place(spec, c.px, c.py);
          out.push(
            <img key={`b${plot.id},${x},${y}`} src={url(spec.file)} alt=""
              className={plot.mine ? "ig-bed ig-bed-mine" : "ig-bed"}
              style={{ ...b, zIndex: depth(y + 0.45) }} />,
          );
        }
      }
    }
    return out;
  }, [garden.plots]);

  return (
    <div className="ig-viewport" ref={viewport} tabIndex={0} aria-label="The garden">
      <div className="ig-world" ref={world}>
        {ground}
        {beds}
        {scenery}
        <img ref={avatar} className="ig-avatar" alt="You" src={url(ART.avatar.s.file)}
          style={{ width: ART.avatar.s.size[0], height: ART.avatar.s.size[1] }} />
      </div>

      {/* One overlay across the whole ground plane. Per-tile gradients only
          band; depth has to be applied to the plane, not to each tile. */}
      <div className="ig-haze" aria-hidden />

      {target && !frozen && (
        <div className="ig-prompt">
          <kbd>Space</kbd> {target.label}
        </div>
      )}
      {note && <div className="ig-note">{note}</div>}
      <div className="ig-help">
        <kbd>WASD</kbd> / <kbd>arrows</kbd> move · <kbd>Space</kbd> act
      </div>
    </div>
  );
}
