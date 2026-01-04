import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";

export async function settleRound(roundId, result) {
  // result should be an object: { number, color, size }
  const bets = await Bet.find({ roundId, status: "PENDING" });

  for (const bet of bets) {
    const wallet = await Wallet.findOne({ userId: bet.userId });
    if (!wallet) continue;

    let payout = 0;
    const netAmount = +(bet.amount * 0.98).toFixed(2); // apply fee only at payout

    // Apply Wingo rules
    if (bet.type === "COLOR") {
      if (bet.option.toLowerCase() === result.color) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else if (
        (bet.option.toLowerCase() === "red" ||
          bet.option.toLowerCase() === "green") &&
        result.color === "violet"
      ) {
        payout = netAmount * 1.5; // partial win
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "SIZE") {
      if (bet.option.toLowerCase() === result.size) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "NUMBER") {
      if (String(bet.option) === String(result.number)) {
        payout = netAmount * 9;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "VIOLET") {
      if (result.color === "violet") {
        payout = netAmount * 4.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    }

    // Credit wallet if won
    if (payout > 0) {
      wallet.balance += payout;
      wallet.locked -= bet.amount;
      await wallet.save();

      await Ledger.create({
        userId: bet.userId,
        roundId,
        type: "CREDIT",
        amount: payout,
        balanceAfter: wallet.balance,
        meta: { betId: bet._id, result },
      });
    } else {
      // Lost bet: release locked funds only
      wallet.locked -= bet.amount;
      await wallet.save();
    }

    await bet.save();
  }

  // ✅ Update round status in DB
  await Round.updateOne({ roundId }, { $set: { status: "SETTLED", result } });
}
