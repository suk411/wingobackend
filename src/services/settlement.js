import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";

export async function settleRound(roundId, result) {
  const bets = await Bet.find({ roundId, status: "PENDING" });

  for (const bet of bets) {
    const wallet = await Wallet.findOne({ userId: bet.userId });
    if (!wallet) continue;

    let payout = 0;
    const netAmount = +(bet.amount * 0.98).toFixed(2);

    if (bet.type === "COLOR") {
      if (bet.option.toLowerCase() === result.color.toLowerCase()) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else if (
        result.includesViolet &&
        (bet.option.toLowerCase() === "red" ||
          bet.option.toLowerCase() === "green")
      ) {
        payout = netAmount * 1.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    } else if (bet.type === "SIZE") {
      if (bet.option.toLowerCase() === result.size.toLowerCase()) {
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
      if (result.includesViolet) {
        payout = netAmount * 4.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }
    }

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
      wallet.locked -= bet.amount;
      await wallet.save();
    }

    await bet.save();
  }

  await Round.updateOne({ roundId }, { $set: { status: "SETTLED", result } });
}
