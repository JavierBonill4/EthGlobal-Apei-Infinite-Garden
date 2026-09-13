"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * ADVENTURE VIEW -- the side-scroll walk, in the app.
 *
 * This is the React port of art/backgrounds/stroll/stroll-preview.html, and it
 * deliberately uses the SAME technique and the SAME art rather than inventing
 * a parallel one:
 *
 *   - the world is Stroll.png repeated TILE_COUNT times in a row
 *   - Trees.png is a second row on the same transform, rendered ABOVE the
 *     character, so you walk behind trunks
 *   - the character never moves on screen; the world slides under it
 *
 * Keeping the two in step matters more than any improvement I could make here:
 * the preview is where the art is iterated, and if this drifts from it the
 * preview stops predicting what the game looks like.
 *
 * SELF-CONTAINED ON PURPOSE. It takes no game state -- only a way out. The
 * epoch, the well and the seed economy are not visible from the woodland, and
 * that is the design: being away is supposed to cost you something you cannot
 * watch.
 */

/** Copies of the backdrop laid edge to edge. */
const TILE_COUNT = 10;
/** World pixels per frame, in the backdrop's own 1920x1080 space. */
const WALK_SPEED = 4.2;
/** Stroll.png's native size; the world is scaled to the viewport's height. */
const NATIVE_W = 1920;
const NATIVE_H = 1080;

const STROLL = "/art/backgrounds/stroll/Stroll.png";
const TREES = "/art/backgrounds/stroll/Trees.png";
const AVATAR = (f: "s" | "e" | "w") => `/art/world/avatar-${f}.svg`;

export function AdventureView({ onLeave }: { onLeave: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const foreEl = useRef<HTMLDivElement>(null);
  const charEl = useRef<HTMLDivElement>(null);
  const spriteEl = useRef<HTMLImageElement>(null);

  const worldX = useRef(0);
  const facing = useRef<"s" | "e" | "w">("s");
  const keys = useRef<Record<string, boolean>>({});

  /* ---- the loop ---- */
  useEffect(() => {
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const vp = viewport.current;
      if (!vp) return;

      const scale = vp.clientHeight / NATIVE_H;
      const tileW = NATIVE_W * scale;
      // Clamp so you cannot walk off the end of the tiled world.
      const maxX = Math.max(0, tileW * TILE_COUNT - vp.clientWidth);

      const k = keys.current;
      const left = k.ArrowLeft || k.a;
      const right = k.ArrowRight || k.d;
      let moving = false;

      if (left && !right) {
        worldX.current = Math.max(0, worldX.current - WALK_SPEED);
        facing.current = "w";
        moving = true;
      } else if (right && !left) {
        worldX.current = Math.min(maxX, worldX.current + WALK_SPEED);
        facing.current = "e";
        moving = true;
      } else {
        // Idle faces the camera, so standing still reads as standing still.
        facing.current = "s";
      }

      const t = `translateX(${-worldX.current}px)`;
      if (worldEl.current) worldEl.current.style.transform = t;
      // The foreground rides the SAME transform, which is the whole reason the
      // trunks stay registered with the backdrop copy they belong to.
      if (foreEl.current) foreEl.current.style.transform = t;

      const want = AVATAR(facing.current);
      if (spriteEl.current && !spriteEl.current.src.endsWith(want)) {
        spriteEl.current.src = want;
      }
      charEl.current?.classList.toggle("walking", moving);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---- input ---- */
  const leave = useCallback(() => onLeave(), [onLeave]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keys.current[k] = true;
      if (e.key === "Escape") leave();
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
  }, [leave]);

  const copies = Array.from({ length: TILE_COUNT }, (_, i) => i);

  return (
    <div className="ig-stroll" ref={viewport}>
      <div className="ig-stroll-world" ref={worldEl}>
        {copies.map((i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={STROLL} alt="" draggable={false} />
        ))}
      </div>

      <div className="ig-stroll-char" ref={charEl}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={spriteEl} src={AVATAR("s")} alt="You" draggable={false} />
      </div>

      {/* Above the character. Trees.png is the same 1920x1080 canvas as the
          backdrop with only the near trunks painted, transparent elsewhere. */}
      <div className="ig-stroll-fore" ref={foreEl}>
        {copies.map((i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={TREES} alt="" draggable={false} />
        ))}
      </div>

      <div className="ig-stroll-cost">
        <p className="ig-label">You are away</p>
        <p>
          Nothing is watering your plot while you are out here, and the epoch
          does not pause for you.
        </p>
        <button className="ig-btn ig-btn-quiet" onClick={leave}>
          Walk back to the garden
        </button>
      </div>

      <div className="ig-help">
        <kbd>A</kbd>/<kbd>D</kbd> or <kbd>←</kbd>/<kbd>→</kbd> walk · <kbd>Esc</kbd> go home
      </div>
    </div>
  );
}
