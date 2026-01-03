import { Router } from "express";
import User from "../models/User.js";

const router = Router();

// Wallet balance
router.get("/wallet/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // For now, just return dummy balance until Wallet model is ready
    res.json({
      userId,
      available: 5000,
      locked: 0,
    });
  } catch (err) {
    next(err);
  }
});

// Ledger history
router.get("/ledger/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    // Replace with Ledger model query once implemented
    res.json([
      { type: "DEBIT", amount: 100, roundId: "2026010300180" },
      { type: "FEE", amount: 2, roundId: "2026010300180" },
      { type: "CREDIT", amount: 200, roundId: "2026010300180" },
    ]);
  } catch (err) {
    next(err);
  }
});

export default router;
