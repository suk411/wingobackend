import Round from "../models/Round.js";
import { settleRound } from "./settlement.js"; // payout logic we wrote earlier

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

// Close round and generate result
export async function closeRound(roundId, result) {
  const round = await Round.findOne({ roundId });
  if (!round) throw new Error("Round not found");

  round.status = "REVEALED";
  round.result = result;
  await round.save();

  // Settle bets
  await settleRound(roundId, result.color || result.number || result.size);

  round.status = "SETTLED";
  await round.save();

  return round;
}
