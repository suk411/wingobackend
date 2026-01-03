// src/routes/betRoutes.js
import { Router } from "express";
import { placeBet } from "../services/betting.js";

const router = Router();

router.post("/bet", async (req, res) => {
  try {
    const { userId, roundId, bets } = req.body;
    if (!userId || !roundId || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const betIds = await placeBet({ userId, roundId, bets });
    res.json({ roundId, betIds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
