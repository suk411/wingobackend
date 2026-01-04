import { Router } from "express";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";

const router = Router();
// Wallet balance
router.get("/wallet/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ userId, balance: wallet.balance, locked: wallet.locked });
  } catch (err) {
    next(err);
  }
});

// Ledger history
router.get("/ledger/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const ledgerEntries = await Ledger.find({ userId }).sort({ createdAt: -1 });
    res.json(ledgerEntries);
  } catch (err) {
    next(err);
  }
});

export default router;
