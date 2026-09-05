/**
 * THE ART SWAP POINT for the frontend.
 *
 * This is the ONLY file in web/ that knows where art lives. If you find
 * yourself importing an SVG anywhere else, that's a bug -- route it through
 * here instead, or the designer's drop-in replacement workflow breaks.
 *
 * See art/ART.md for the asset manifest and the handoff brief.
 */

import manifest from "../../../art/manifest.json";

export type HealthBand = "thriving" | "steady" | "stressed" | "dying";
export type PlotState = HealthBand | "wilderness";

/**
 * Mirrored in contracts/src/art/PlaceholderArt.sol and art/manifest.json.
 * If these three drift, a plot looks thriving on-chain and dying in the app.
 */
export function bandFor(health: number): HealthBand {
  const b = manifest.healthBands;
  if (health >= b.thriving) return "thriving";
  if (health >= b.steady) return "steady";
  if (health >= b.stressed) return "stressed";
  return "dying";
}

export function plotAsset(state: PlotState): string {
  return `/art/${manifest.backgrounds[state]}`;
}

export type CreatureClass = "common" | "uncommon" | "rare" | "mythical";

export function creatureAsset(cls: CreatureClass, key: string): string | null {
  const group = manifest.creatures[cls] as Record<string, string>;
  const path = group?.[key];
  return path ? `/art/${path}` : null;
}

export function uiAsset(key: keyof typeof manifest.ui): string {
  return `/art/${manifest.ui[key]}`;
}

export function overlayAsset(kind: "scarred" | "healed"): string {
  return `/art/${manifest.overlays[kind]}`;
}

/**
 * One plot. Deliberately dumb: it takes health numbers and renders, with no
 * knowledge of contracts or queries.
 *
 * Note that creatures are composited ON TOP of the plot rather than baked in.
 * Creatures leaving is the main health signal in the game -- see ART.md -- so
 * they have to be able to disappear independently of the ground.
 */
export function PlotTile({
  waterHealth,
  nutrientHealth,
  isWilderness = false,
  creature = null,
  scarred = false,
  healed = false,
  size = 160,
}: {
  waterHealth: number;
  nutrientHealth: number;
  isWilderness?: boolean;
  creature?: { cls: CreatureClass; key: string } | null;
  scarred?: boolean;
  healed?: boolean;
  size?: number;
}) {
  // Water is the more urgent signal, so it drives the ground. Nutrients show
  // through the creature layer instead.
  const state: PlotState = isWilderness ? "wilderness" : bandFor(waterHealth);
  const creatureSrc = creature ? creatureAsset(creature.cls, creature.key) : null;

  return (
    <div
      className="ig-plot"
      style={{ position: "relative", width: size, height: size }}
      data-state={state}
      data-nutrient={bandFor(nutrientHealth)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plotAsset(state)} alt="" width={size} height={size} />

      {creatureSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creatureSrc}
          alt=""
          width={size * 0.4}
          height={size * 0.4}
          style={{
            position: "absolute",
            bottom: size * 0.08,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      )}

      {(scarred || healed) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={overlayAsset(healed ? "healed" : "scarred")}
          alt={healed ? "healed" : "scarred"}
          width={size}
          height={size}
          style={{ position: "absolute", inset: 0 }}
        />
      )}
    </div>
  );
}
