import Round from "../models/Round.js";

// Save round start in MongoDB
export async function createRound(roundId, startTs, endTs) {
  const round = new Round({
    roundId,
    status: "BETTING",
    createdAt: new Date(startTs),
  });
  await round.save();
  return round;
}

// Remove closeRound auto-settlement; rely on resultReveal + settlement orchestrations.
// If you still need a closeRound helper, keep it minimal and DO NOT settle here.
export async function closeRound(roundId, result) {
  const round = await Round.findOne({ roundId });
  if (!round) throw new Error("Round not found");

  round.status = "REVEALED";
  round.result = result;
  await round.save();

  return round;
}
