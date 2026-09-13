import sealed from "./sealed.json";

/**
 * The seed phrase: nineteen slots, seven given as scaffolding, twelve to
 * supply. Twelve is not a coincidence -- it is the shape of a BIP-39 phrase,
 * and the joke is that none of the words is in the BIP-39 wordlist.
 *
 * The answer is the project's own thesis, which is why the reward is
 * information rather than resource: DESIGN.md 06 is explicit that rewards can
 * be unequal and POWERS CANNOT. A player who solves a word puzzle must not end
 * up with an edge over the commons.
 */
export type Slot = { given: string | null };

/** 0-indexed. The given words are the mortar; the blanks are the phrase. */
const GIVEN: Record<number, string> = {
  0: "A", 3: "is", 6: "the", 8: "of", 10: "An", 14: "the", 16: "of",
};
export const SLOT_COUNT = 19;
export const SLOTS: Slot[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
  given: GIVEN[i] ?? null,
}));
export const BLANK_INDICES = SLOTS.map((s, i) => (s.given ? -1 : i)).filter((i) => i >= 0);
export const BLANK_COUNT = BLANK_INDICES.length;   // 12

/**
 * MUST match normalise() in web/scripts/seal.mjs exactly. If these drift the
 * correct answer silently stops working and nothing explains why, so they are
 * cross-referenced in both files rather than shared -- the script runs in node
 * before the bundle exists.
 */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Assemble the full nineteen words from the given scaffolding plus guesses. */
export function assemble(guesses: Record<number, string>): string {
  return SLOTS.map((s, i) => s.given ?? (guesses[i] ?? "")).join(" ");
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Try to open the reward with a phrase. Returns the plaintext, or null.
 *
 * There is no comparison here and no answer in the bundle -- a wrong phrase
 * derives a wrong key and AES-GCM simply fails its authentication tag. The
 * failure is cryptographic, not a branch somebody can read.
 */
export async function unseal(phrase: string): Promise<string | null> {
  const words = normalise(phrase);
  if (words.split(" ").length !== SLOT_COUNT) return null;
  try {
    const base = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(words), "PBKDF2", false, ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64(sealed.salt), iterations: sealed.iterations, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
    );
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64(sealed.iv) }, key, b64(sealed.ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;   // wrong phrase. Indistinguishable from a corrupt payload, deliberately.
  }
}

/**
 * Hints, found in the woodland rather than given.
 *
 * The brief was hard and confusing, so these point at the STRUCTURE of the
 * phrase and never at a word. A hint that names a word is not a hint, it is
 * the answer arriving late.
 */
export const HINTS: string[] = [
  "Three of the twelve you must supply are said twice. None of them is the answer.",
  "Nothing here is a BIP-39 word. If you are reaching for a wordlist you have mistaken the lock.",
  "The first half ends. The second does not.",
  "Both halves ask the same question of the same noun.",
  "What a finite player wants, an infinite player refuses to want.",
  "One man wrote it in 1986, and he was not writing about gardens.",
];
