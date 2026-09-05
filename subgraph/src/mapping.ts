import { BigInt } from "@graphprotocol/graph-ts";
import {
  SeasonStarted,
  PlotClaimed,
  PlotCeded,
  PlotReverted,
  WaterDrawn,
  SeedsContributed,
  EpochSettled,
  SeasonEnded,
} from "../generated/Garden/Garden";
import {
  Season,
  EpochRecord,
  Player,
  Plot,
  Draw,
  SeedContribution,
  Collapse,
} from "../generated/schema";

// Current season id. Single-season-at-a-time, so "1" until a completion bumps
// it. TODO: read from contract state once multi-season is live.
const SEASON_ID = "1";

function loadPlayer(address: string): Player {
  let p = Player.load(address);
  if (p == null) {
    p = new Player(address);
    p.totalDrawn = BigInt.zero();
    p.totalForborne = BigInt.zero();
    p.seedsGiven = BigInt.zero();
    p.epochsPresent = 0;
    p.collapsesPresentFor = 0;
    p.save();
  }
  return p as Player;
}

function loadEpoch(epoch: i32): EpochRecord {
  let id = SEASON_ID + "-" + epoch.toString();
  let e = EpochRecord.load(id);
  if (e == null) {
    e = new EpochRecord(id);
    e.season = SEASON_ID;
    e.epoch = epoch;
    e.totalDrawn = BigInt.zero();
    e.totalForborne = BigInt.zero();
    e.save();
  }
  return e as EpochRecord;
}

export function handleSeasonStarted(event: SeasonStarted): void {
  let s = new Season(event.params.level.toString());
  s.level = event.params.level;
  s.genesis = event.params.genesis;
  s.outcome = "Running";
  s.plotsAtStart = event.params.plots;
  s.save();
}

export function handlePlotClaimed(event: PlotClaimed): void {
  let owner = loadPlayer(event.params.owner.toHexString());
  let p = new Plot(event.params.plotId.toString());
  p.owner = owner.id;
  p.status = "Active";
  p.joinedEpoch = 0;
  p.lastTendedEpoch = 0;
  p.offlineMode = "None";
  p.waterHealthAtLastAction = 0;
  p.nutrientHealthAtLastAction = 0;
  p.save();

  owner.plot = p.id;
  owner.save();
}

export function handlePlotCeded(event: PlotCeded): void {
  let p = Plot.load(event.params.plotId.toString());
  if (p == null) return;
  p.owner = loadPlayer(event.params.to.toHexString()).id;
  p.save();
}

export function handlePlotReverted(event: PlotReverted): void {
  let p = Plot.load(event.params.plotId.toString());
  if (p == null) return;
  p.status = "Wilderness";
  p.owner = null;
  p.steward = null;
  p.save();
}

/// The ledger's core handler. `forborne` matters as much as `amount` --
/// see schema.graphql.
export function handleWaterDrawn(event: WaterDrawn): void {
  let player = loadPlayer(event.params.by.toHexString());
  let epochRec = loadEpoch(event.params.epoch);

  let d = new Draw(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  d.epochRecord = epochRec.id;
  d.plot = event.params.plotId.toString();
  d.player = player.id;
  d.epoch = event.params.epoch;
  d.amount = BigInt.fromI32(event.params.amount);
  d.forborne = BigInt.fromI32(event.params.forborne);
  d.timestamp = event.block.timestamp;
  d.txHash = event.transaction.hash;
  d.save();

  player.totalDrawn = player.totalDrawn.plus(d.amount);
  player.totalForborne = player.totalForborne.plus(d.forborne);
  player.save();

  epochRec.totalDrawn = epochRec.totalDrawn.plus(d.amount);
  epochRec.totalForborne = epochRec.totalForborne.plus(d.forborne);
  epochRec.save();
}

export function handleSeedsContributed(event: SeedsContributed): void {
  let c = new SeedContribution(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  c.plot = event.params.plotId.toString();
  c.epoch = event.params.epoch;
  c.amount = BigInt.fromI32(event.params.amount);
  c.timestamp = event.block.timestamp;
  c.save();
}

export function handleEpochSettled(event: EpochSettled): void {
  let e = loadEpoch(event.params.epoch);
  e.requirement = event.params.requirement;
  e.wellLevel = event.params.wellLevel;
  e.plotsMet = event.params.plotsMet;
  e.plotsMissed = event.params.plotsMissed;
  e.settledAt = event.block.timestamp;
  e.save();
}

export function handleSeasonEnded(event: SeasonEnded): void {
  let s = Season.load(event.params.level.toString());
  if (s == null) return;

  let outcome = "Completed";
  if (event.params.outcome == 2) outcome = "CollapsedDepletion";
  if (event.params.outcome == 3) outcome = "CollapsedStagnation";

  s.outcome = outcome;
  s.endedAtEpoch = event.params.atEpoch;
  s.save();

  if (outcome != "Completed") {
    let c = new Collapse(s.id + "-collapse");
    c.season = s.id;
    c.atEpoch = event.params.atEpoch;
    c.outcome = outcome;
    // TODO: track the running low-water mark across the season.
    c.wellLowWaterMark = 0;
    c.timestamp = event.block.timestamp;
    c.save();
  }
}
