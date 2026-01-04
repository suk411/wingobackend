import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";

export async function settleRound(roundId, result) {
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

    // COLOR bets
    if (bet.type === "COLOR" && typeof bet.option === "string") {
      const opt = bet.option.toLowerCase();
      const resColor = result.color.toLowerCase();

      if (opt === resColor) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else if (result.includesViolet && (opt === "red" || opt === "green")) {
        payout = netAmount * 1.5;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // SIZE bets
    } else if (bet.type === "SIZE" && typeof bet.option === "string") {
      if (bet.option.toLowerCase() === result.size.toLowerCase()) {
        payout = netAmount * 2;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // NUMBER bets
    } else if (bet.type === "NUMBER") {
      if (String(bet.option) === String(result.number)) {
        payout = netAmount * 9;
        bet.status = "WON";
      } else {
        bet.status = "LOST";
      }

      // VIOLET bets
    } else if (bet.type === "VIOLET") {
      if (result.includesViolet) {
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
      wallet.locked -= bet.amount;
      await wallet.save();
    }

    await bet.save();
  }

  // ✅ Update round status and result
  await Round.updateOne({ roundId }, { $set: { status: "SETTLED", result } });
}
