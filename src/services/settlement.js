import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";
import redis from "../config/redis.js";

export async function settleRound(roundId, resultOverride) {
  // Always settle using the frozen result in Redis unless an explicit override is provided (rare).
  let finalResult = resultOverride;
  if (!finalResult) {
    const resultJson = await redis.get(`wingo:round:${roundId}:result`);
    if (!resultJson) {
      console.error(`❌ No frozen result found for round ${roundId}`);
      return;
    }
    finalResult = JSON.parse(resultJson);
  }

  const bets = await Bet.find({ roundId, status: "PENDING" });

  for (const bet of bets) {
    if (!bet.option) {
      console.warn(`⚠️ Skipping bet with missing option:`, bet);
      continue;
    }

    const wallet = await Wallet.findOne({ userId: bet.userId });
    if (!wallet) continue;

    let payout = 0;
    const netAmount = +(bet.amount * 0.98).toFixed(2);

    // COLOR
    if (bet.type === "COLOR" && typeof bet.option === "string") {
      const opt = bet.option.toLowerCase();
      const resColor = finalResult.color ? finalResult.color.toLowerCase() : "";

      if (opt === resColor) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else if (
        finalResult.includesViolet &&
        (opt === "red" || opt === "green")
      ) {
        payout = netAmount * 1.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // SIZE
    } else if (bet.type === "SIZE" && typeof bet.option === "string") {
      if (
        finalResult.size &&
        bet.option.toLowerCase() === finalResult.size.toLowerCase()
      ) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // NUMBER
    } else if (bet.type === "NUMBER") {
      if (String(bet.option) === String(finalResult.number)) {
        payout = netAmount * 9;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // VIOLET
    } else if (bet.type === "VIOLET") {
      if (finalResult.includesViolet) {
        payout = netAmount * 4.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    }

    // Wallet + Ledger
    wallet.locked -= bet.amount;
    if (payout > 0) {
      wallet.balance += payout;
      await wallet.save();

      await Ledger.create({
        userId: bet.userId,
        roundId,
        type: "CREDIT",
        amount: payout,
        balanceAfter: wallet.balance,
        meta: { betId: bet._id, result: finalResult },
      });
    } else {
      await wallet.save();
    }

    await bet.save();
  }

  await Round.updateOne(
    { roundId },
    { $set: { status: "SETTLED", result: finalResult } }
  );
}
