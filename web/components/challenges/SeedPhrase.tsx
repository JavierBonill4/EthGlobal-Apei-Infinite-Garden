"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BLANK_COUNT, HINTS, SLOTS, assemble, unseal,
} from "../../lib/challenges/seedphrase";

/**
 * The one real challenge. Type twelve words into nineteen slots.
 *
 * No answer is shipped and no reward text is shipped -- see
 * lib/challenges/seedphrase.ts. "Check" derives a key and tries to decrypt, so
 * a wrong phrase fails an AES-GCM tag rather than a comparison somebody can
 * read in devtools.
 */
export function SeedPhrase({
  hintsFound,
  onSolved,
  solvedText,
}: {
  hintsFound: number[];
  onSolved: (text: string) => void;
  solvedText: string | null;
}) {
  const [guesses, setGuesses] = useState<Record<number, string>>({});
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");
  const filled = useMemo(
    () => Object.values(guesses).filter((v) => v.trim().length > 0).length,
    [guesses],
  );

  const check = useCallback(async () => {
    setState("checking");
    const text = await unseal(assemble(guesses));
    if (text) { onSolved(text); return; }
    setState("wrong");
    window.setTimeout(() => setState("idle"), 900);
  }, [guesses, onSolved]);

  if (solvedText) {
    return (
      <div className="ig-sp">
        <p className="ig-label">Opened</p>
        <div className="ig-sp-reward">
          {solvedText.split("\n").map((line, i) => (
            <p key={i} className={line.startsWith("#") ? "ig-sp-h" : line.startsWith(">") ? "ig-sp-q" : ""}>
              {line.replace(/^#+\s*/, "").replace(/^>\s*/, "").replace(/\*\*/g, "").replace(/^\|.*/, "")}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ig-sp">
      <p className="ig-ch-rule">
        Twelve words. Seven are already set. Nothing here is in any wordlist.
      </p>

      <div className="ig-sp-grid">
        {SLOTS.map((s, i) =>
          s.given ? (
            <span key={i} className="ig-sp-given">{s.given}</span>
          ) : (
            <input
              key={i}
              className="ig-sp-in"
              value={guesses[i] ?? ""}
              onChange={(e) => setGuesses((g) => ({ ...g, [i]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") check(); }}
              aria-label={`word ${i + 1}`}
              autoComplete="off"
              spellCheck={false}
            />
          ),
        )}
      </div>

      <div className={state === "wrong" ? "ig-sp-bar ig-shake" : "ig-sp-bar"} key={state}>
        <span className="ig-ch-count">{filled} / {BLANK_COUNT} supplied</span>
        <button className="ig-btn" onClick={check} disabled={state === "checking"}>
          {state === "checking" ? "…" : state === "wrong" ? "Not it" : "Try the phrase"}
        </button>
      </div>

      <div className="ig-sp-hints">
        <p className="ig-label">
          Hints found in the woodland · {hintsFound.length} of {HINTS.length}
        </p>
        {hintsFound.length === 0 ? (
          <p className="ig-sp-nohint">
            None yet. They are out here, behind the trunks, off the walked line.
          </p>
        ) : (
          <ul>
            {hintsFound.slice().sort((a, b) => a - b).map((h) => (
              <li key={h}>{HINTS[h]}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
