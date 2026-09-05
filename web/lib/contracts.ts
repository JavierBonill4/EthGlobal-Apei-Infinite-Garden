/**
 * Contract addresses and the minimal ABI the app needs.
 *
 * Full ABIs live in contracts/out/ after `forge build`. Import from there
 * rather than growing this file -- these fragments exist so the app compiles
 * before anything is deployed.
 */

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

export const addresses = {
  garden: process.env.NEXT_PUBLIC_GARDEN_ADDRESS as `0x${string}` | undefined,
  standing: process.env.NEXT_PUBLIC_STANDING_ADDRESS as `0x${string}` | undefined,
  collectibles: process.env.NEXT_PUBLIC_COLLECTIBLES_ADDRESS as `0x${string}` | undefined,
} as const;

/**
 * Public parameters. Fetch these from the chain rather than hardcoding them in
 * the UI -- they are public on purpose, and a UI that shows stale numbers
 * undermines the one guarantee the design makes: hide the roll, not the rules.
 */
export const gardenAbi = [
  { type: "function", name: "REQ_MIN", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "REQ_MAX", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "REQ_STEP", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "HEALTH_MAX", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "STAKE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentEpoch", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  {
    type: "function",
    name: "healthOf",
    stateMutability: "view",
    inputs: [{ name: "plotId", type: "uint256" }],
    outputs: [{ name: "water", type: "uint16" }, { name: "nutrient", type: "uint16" }],
  },
  {
    type: "function",
    name: "well",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint32" }, { type: "uint32" }, { type: "uint32" }],
  },
  { type: "function", name: "joinQueue", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "drawWater",
    stateMutability: "nonpayable",
    inputs: [{ name: "plotId", type: "uint256" }, { name: "amount", type: "uint32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "buyNutrients",
    stateMutability: "nonpayable",
    inputs: [{ name: "plotId", type: "uint256" }, { name: "amount", type: "uint32" }],
    outputs: [],
  },
  { type: "function", name: "settleBegin", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
