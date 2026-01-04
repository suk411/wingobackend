import { Router } from "express";
import { placeBet } from "../services/betting.js";
import Bet from "../models/Bet.js";
import jwt from "jsonwebtoken";

const router = Router();

// ✅ Place bet
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

// ✅ Get bets of logged-in user (paginated)
router.get("/bets", async (req, res) => {
  try {
    // Extract userId from JWT
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const bets = await Bet.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Bet.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);

    res.json({ page, totalPages, totalBets: total, bets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
