import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";

export async function settleRound(roundId, result) {
  const bets = await Bet.find({ roundId, status: "PENDING" });

  for (const bet of bets) {
    const wallet = await Wallet.findOne({ userId: bet.userId });
    if (!wallet) continue;

    let payout = 0;
    const netAmount = +(bet.amount * 0.98).toFixed(2); // apply fee only at payout

    // Apply Wingo rules
    if (bet.type === "COLOR") {
      if (bet.option.toLowerCase() === result) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else if (
        (bet.option.toLowerCase() === "red" ||
          bet.option.toLowerCase() === "green") &&
        result === "violet"
      ) {
        payout = netAmount * 1.5; // partial win
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "SIZE") {
      if (bet.option.toLowerCase() === result) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "NUMBER") {
      if (String(bet.option) === String(result)) {
        payout = netAmount * 9;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "VIOLET") {
      if (result === "violet") {
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
}
