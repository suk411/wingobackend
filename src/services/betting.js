import crypto from "crypto";
import redis from "../config/redis.js";
import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";

export async function placeBet({ userId, roundId, bets }) {
  // Get current round pointer
  const stateKey = await redis.get("wingo:round:current");
  if (!stateKey) throw new Error("No active round");

  const state = await redis.hgetall(stateKey);
  if (!state?.end_ts || state.id !== roundId) throw new Error("Round mismatch");
  if (state.status !== "BETTING") throw new Error("Betting closed");

  const remainingMs = Number(state.end_ts) - Date.now();
  if (remainingMs <= 5000) throw new Error("Inside 5s gate");

  // Calculate totals
  const grossTotal = bets.reduce((s, b) => s + Number(b.amount), 0);
  const feeTotal = +(grossTotal * 0.02).toFixed(2);
  const totalDebit = grossTotal + feeTotal;

  // Wallet check
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.available < totalDebit) {
    throw new Error("Insufficient balance");
  }

  // Deduct funds immediately (bet + fee)
  wallet.available -= totalDebit;
  wallet.locked += grossTotal; // optional: lock bet amount until round resolves
  await wallet.save();

  // Ledger entries
  await Ledger.create([
    {
      userId,
      roundId,
      type: "DEBIT",
      amount: grossTotal,
      balanceAfter: wallet.available,
      meta: { bets },
    },
    {
      userId,
      roundId,
      type: "FEE",
      amount: feeTotal,
      balanceAfter: wallet.available,
      meta: {},
    },
  ]);

  // Save bets + update Redis exposures
  const betBaseId = crypto.randomUUID();
  const betDocs = [];

  for (const [idx, b] of bets.entries()) {
    const netAmount = +(b.amount * 0.98).toFixed(2);
    const betId = `${betBaseId}-${idx}`;

    const betDoc = {
      betId,
      userId,
      roundId,
      type: b.type,
      option: b.option,
      amount: b.amount,
      netAmount,
      status: "COMMITTED",
    };
    betDocs.push(betDoc);

    // Update exposures
    if (b.type === "COLOR") {
      await redis.hincrbyfloat(
        `wingo:round:${roundId}:exposure:color`,
        b.option.toLowerCase(),
        netAmount
      );
    } else if (b.type === "SIZE") {
      await redis.hincrbyfloat(
        `wingo:round:${roundId}:exposure:size`,
        b.option.toLowerCase(),
        netAmount
      );
    } else if (b.type === "NUMBER") {
      await redis.hincrbyfloat(
        `wingo:round:${roundId}:exposure:number`,
        String(b.option),
        netAmount
      );
    } else if (b.type === "VIOLET") {
      await redis.hincrbyfloat(
        `wingo:round:${roundId}:exposure:color`,
        "violet",
        netAmount
      );
    }

    // Append bet to Redis list
    await redis.lpush(`wingo:round:${roundId}:bets`, JSON.stringify(betDoc));
  }

  // Persist bets in MongoDB
  await Bet.insertMany(betDocs);

  // Return bet IDs for audit
  return betDocs.map((d) => d.betId);
}
