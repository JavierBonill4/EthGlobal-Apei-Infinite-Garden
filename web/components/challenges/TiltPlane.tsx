"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeProps } from "./types";

/**
 * PLACEHOLDER CHALLENGE — tilt the plane.
 *
 * Deliberately generic: a slot, not a design. See types.ts.
 *
 * Arrow keys tilt the ground; loose seeds roll downhill; get every seed into a
 * ring and hold it there. The only reason it is this and not something simpler
 * is that it needs a hand on it continuously -- a challenge you can solve by
 * thinking once and clicking once would be free water, which is exactly the
 * failure mode flagged in useGarden.waterFromCistern.
 */
const SIZE = 320, WALL = 16, G = 0.055, FRICTION = 0.982, BOUNCE = 0.45;
const SEEDS = [{ x: 90, y: 90 }, { x: 230, y: 110 }, { x: 140, y: 240 }];
const TARGETS = [{ x: 80, y: 240 }, { x: 240, y: 240 }, { x: 160, y: 80 }];
const HOLD_MS = 700;

export function TiltPlane({ onSolved }: ChallengeProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [inCount, setInCount] = useState(0);
  const state = useRef({
    seeds: SEEDS.map((s) => ({ ...s, vx: 0, vy: 0 })),
    tilt: { x: 0, y: 0 },
    since: 0,
    done: false,
  });

  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const down = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow")) e.preventDefault();
      keys[e.key] = true;
    };
    const up = (e: KeyboardEvent) => { keys[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = state.current;
      if (s.done) return;
      const want = {
        x: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0),
        y: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0),
      };
      s.tilt.x += (want.x - s.tilt.x) * 0.12;
      s.tilt.y += (want.y - s.tilt.y) * 0.12;
      setTilt({ x: s.tilt.x, y: s.tilt.y });

      let seated = 0;
      for (const seed of s.seeds) {
        seed.vx = (seed.vx + s.tilt.x * G * 16) * FRICTION;
        seed.vy = (seed.vy + s.tilt.y * G * 16) * FRICTION;
        seed.x += seed.vx; seed.y += seed.vy;
        if (seed.x < WALL) { seed.x = WALL; seed.vx = -seed.vx * BOUNCE; }
        if (seed.x > SIZE - WALL) { seed.x = SIZE - WALL; seed.vx = -seed.vx * BOUNCE; }
        if (seed.y < WALL) { seed.y = WALL; seed.vy = -seed.vy * BOUNCE; }
        if (seed.y > SIZE - WALL) { seed.y = SIZE - WALL; seed.vy = -seed.vy * BOUNCE; }
        if (TARGETS.some((t) => Math.hypot(t.x - seed.x, t.y - seed.y) < 20)) seated++;
      }
      setInCount(seated);

      // Every seed home, and held there -- otherwise a seed rolling straight
      // through a ring would win it for you.
      if (seated === s.seeds.length) {
        if (!s.since) s.since = performance.now();
        else if (performance.now() - s.since > HOLD_MS) { s.done = true; onSolved(); }
      } else s.since = 0;

      const g = svg.current;
      if (g) {
        s.seeds.forEach((seed, i) => {
          const el = g.querySelector<SVGCircleElement>(`#seed${i}`);
          if (el) { el.setAttribute("cx", seed.x.toFixed(1)); el.setAttribute("cy", seed.y.toFixed(1)); }
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onSolved]);

  return (
    <div className="ig-ch">
      <p className="ig-ch-rule">
        Tilt the ground with the <kbd>arrow keys</kbd>. Settle every seed in a ring.
      </p>
      <div style={{
        transform: `perspective(700px) rotateX(${-tilt.y * 9}deg) rotateY(${tilt.x * 9}deg)`,
        transition: "transform 90ms linear",
      }}>
        <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} className="ig-ch-svg" role="group"
             aria-label="Tilt the plane">
          <rect x="2" y="2" width={SIZE - 4} height={SIZE - 4} rx="6"
                fill="currentColor" fillOpacity=".05" stroke="currentColor" strokeOpacity=".2" />
          {TARGETS.map((t, i) => (
            <circle key={i} cx={t.x} cy={t.y} r="20" fill="none"
                    stroke="#7E6BA8" strokeWidth="2.5" strokeDasharray="5 4" />
          ))}
          {SEEDS.map((_, i) => (
            <circle key={i} id={`seed${i}`} r="8" fill="#B98A2E"
                    stroke="currentColor" strokeOpacity=".5" strokeWidth="2" />
          ))}
        </svg>
      </div>
      <p className="ig-ch-count">{inCount} / {SEEDS.length} settled</p>
    </div>
  );
}
