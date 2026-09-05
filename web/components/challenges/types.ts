/**
 * The challenge slot.
 *
 * WHAT THESE ARE STANDING IN FOR
 * Both shipped challenges are generic on purpose -- connect the colours, tilt
 * a plane. They exist to prove the seam: you walk into a portal, the world
 * plane drops away, you do a thing, you come back with something. Nothing
 * about either puzzle is a design decision and neither should survive.
 *
 * The real ones have a constraint the placeholders do not: whatever a
 * challenge pays out is water that did NOT come from the well, so a challenge
 * that is too easy quietly removes the dilemma from the game. See
 * useGarden.waterFromCistern for the argument, and docs/OPEN-QUESTIONS.md.
 *
 * To add one: write a component taking ChallengeProps, register it in the
 * REGISTRY in ChallengeHost.tsx, and point a portal at its key in map.ts.
 * Nothing else in the app needs to know it exists.
 */
export type ChallengeProps = {
  /** Call once, when the player has actually finished. */
  onSolved: () => void;
};

export type ChallengeKey = "connect" | "tilt";
