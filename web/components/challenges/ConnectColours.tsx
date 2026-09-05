"use client";

import { useMemo, useState } from "react";
import type { ChallengeProps } from "./types";

/**
 * PLACEHOLDER CHALLENGE — connect the colours.
 *
 * Deliberately generic: this is a slot, not a design. What it is standing in
 * for is stated in types.ts. Do not polish this; replace it.
 *
 * The one thing worth keeping is that the puzzle is GENERATED SOLVABLE rather
 * than generated and then checked. Positions come from a random balanced
 * bracket sequence, and matching brackets are non-crossing by construction --
 * so a layout with no valid answer cannot be produced at all.
 */
const COLOURS = ["#7E6BA8", "#2F7E72", "#A8562F", "#B98A2E", "#3E6E86", "#8C5F8E"];

function solvableLayout(pairs: number): number[] {
  // Random balanced bracket sequence -> pair index per position.
  const n = pairs * 2;
  const owner = new Array<number>(n).fill(-1);
  const stack: number[] = [];
  let open = 0, next = 0;
  for (let i = 0; i < n; i++) {
    const remaining = n - i;
    const mustClose = stack.length === remaining;
    const canOpen = open < pairs && !mustClose;
    if (canOpen && (stack.length === 0 || Math.random() < 0.55)) {
      owner[i] = next; stack.push(next); next++; open++;
    } else {
      owner[i] = stack.pop()!;
    }
  }
  return owner;
}

/** Two chords on a circle cross iff exactly one endpoint of one lies strictly
 *  inside the arc of the other. */
function crosses(a: number, b: number, c: number, d: number) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const inside = (k: number) => k > lo && k < hi;
  return inside(c) !== inside(d);
}

export function ConnectColours({ onSolved }: ChallengeProps) {
  const PAIRS = 4;
  const owner = useMemo(() => solvableLayout(PAIRS), []);
  const n = owner.length;
  const [links, setLinks] = useState<[number, number][]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [shake, setShake] = useState(0);

  const R = 120, CX = 160, CY = 160;
  const at = (i: number) => {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + Math.cos(t) * R, y: CY + Math.sin(t) * R };
  };
  const linked = (i: number) => links.some(([a, b]) => a === i || b === i);

  function click(i: number) {
    if (linked(i)) return;
    if (sel === null) { setSel(i); return; }
    if (sel === i) { setSel(null); return; }
    if (owner[sel] !== owner[i]) { setShake((s) => s + 1); setSel(null); return; }
    if (links.some(([a, b]) => crosses(a, b, sel, i))) { setShake((s) => s + 1); setSel(null); return; }
    const next: [number, number][] = [...links, [sel, i]];
    setLinks(next); setSel(null);
    if (next.length === PAIRS) window.setTimeout(() => onSolved(), 480);
  }

  return (
    <div className="ig-ch">
      <p className="ig-ch-rule">
        Join each pair. No thread may cross another.
      </p>
      <svg viewBox="0 0 320 320" className={shake ? "ig-ch-svg ig-shake" : "ig-ch-svg"}
           key={shake} role="group" aria-label="Connect the colours">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity=".16" />
        {links.map(([a, b], k) => {
          const p = at(a), q = at(b);
          return <path key={k} d={`M${p.x} ${p.y} Q${CX} ${CY} ${q.x} ${q.y}`} fill="none"
            stroke={COLOURS[owner[a] % COLOURS.length]} strokeWidth="3.5" strokeLinecap="round" />;
        })}
        {owner.map((o, i) => {
          const p = at(i);
          return (
            <g key={i} onClick={() => click(i)} style={{ cursor: linked(i) ? "default" : "pointer" }}>
              <circle cx={p.x} cy={p.y} r="17" fill="transparent" />
              <circle cx={p.x} cy={p.y} r={sel === i ? 12 : 9}
                fill={COLOURS[o % COLOURS.length]}
                stroke="currentColor" strokeOpacity={linked(i) ? ".2" : ".55"} strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      <p className="ig-ch-count">{links.length} / {PAIRS} joined</p>
    </div>
  );
}
