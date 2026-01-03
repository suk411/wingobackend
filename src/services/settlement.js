// src/services/settlement.js
import redis from "../config/redis.js";
import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";

export async function settleRound(roundId) {
  const resultKey = `wingo:round:${roundId}:result`;
  const resultRaw = await redis.get(resultKey);
  if (!resultRaw) throw new Error("No result frozen");

  const result = JSON.parse(resultRaw);

  // Fetch all bets
  const betList = await redis.lrange(`wingo:round:${roundId}:bets`, 0, -1);
  const bets = betList.map((b) => JSON.parse(b));

  const settlements = [];

  for (const bet of bets) {
    let win = false;
    let multiplier = 0;

    if (bet.type === "COLOR" && bet.option === result.color) {
      win = true;
      multiplier = 2.0;
    } else if (bet.type === "SIZE" && bet.option === result.size) {
      win = true;
      multiplier = 2.0;
    } else if (bet.type === "NUMBER" && Number(bet.option) === result.number) {
      win = true;
      multiplier = 9.0;
    } else if (bet.type === "VIOLET" && result.includesViolet) {
      win = true;
      multiplier = 4.5;
    }

    if (win) {
      const payout = +(bet.netAmount * multiplier).toFixed(2);

      // Credit wallet
      const wallet = await Wallet.findOne({ userId: bet.userId });
      wallet.available += payout;
      await wallet.save();

      // Ledger entry
      await Ledger.create({
        userId: bet.userId,
        roundId,
        type: "CREDIT",
        amount: payout,
        balanceAfter: wallet.available,
        meta: { betId: bet.betId },
      });

      settlements.push({ betId: bet.betId, payout });
    } else {
      settlements.push({ betId: bet.betId, payout: 0 });
    }
  }

  // Persist round summary
  await Round.create({
    roundId,
    result,
    bets,
    settlements,
  });

  // Update counters
  await redis.incr("wingo:counters:round:count");
  if (result.includesViolet) await redis.incr("wingo:counters:violet:count");

  // Cleanup Redis
  await redis.del(
    `wingo:round:${roundId}:bets`,
    `wingo:round:${roundId}:exposure:color`,
    `wingo:round:${roundId}:exposure:size`,
    `wingo:round:${roundId}:exposure:number`,
    `wingo:round:${roundId}:state`
  );

  console.log("✅ Settlement complete:", roundId);
  return settlements;
}
