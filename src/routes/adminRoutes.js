// src/routes/adminRoutes.js
import { Router } from "express";
import redis from "../config/redis.js";
import Round from "../models/Round.js";
import Bet from "../models/Bet.js";
import { selectResult } from "../services/resultEngine.js";

const router = Router();

// Force result
router.post("/force-result", async (req, res) => {
  const { roundId, number } = req.body;
  if (!roundId || number === undefined) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const color = number % 2 === 0 ? "GREEN" : "RED";
  const size = number <= 4 ? "SMALL" : "BIG";
  const includesViolet = number === 0 || number === 5;
  const result = {
    number,
    color,
    size,
    includesViolet,
    payout: 0,
    freeze_ts: Date.now(),
  };
  await redis.set(
    `wingo:round:${roundId}:result`,
    JSON.stringify(result),
    "NX"
  );
  await redis.hset(`wingo:round:${roundId}:state`, "status", "REVEALED");
  res.json({ roundId, result });
});

// Toggle admin mode
router.post("/mode", async (req, res) => {
  const { mode } = req.body;
  if (!["MAX_PROFIT", "MAX_LOSS"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }
  await redis.set("wingo:admin:mode", mode);
  res.json({ mode });
});

// Get current mode
router.get("/mode", async (req, res) => {
  const mode = await redis.get("wingo:admin:mode");
  res.json({ mode });
});

// Dashboard snapshot
router.get("/dashboard", async (req, res) => {
  const currentKey = await redis.get("wingo:round:current");
  const state = currentKey ? await redis.hgetall(currentKey) : null;
  const violetCount = await redis.get("wingo:counters:violet:count");
  const mode = await redis.get("wingo:admin:mode");
  res.json({ state, violetCount, mode });
});

// Current round snapshot
router.get("/round/current", async (req, res) => {
  try {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) {
      return res.status(404).json({ error: "No active round" });
    }

    const state = await redis.hgetall(currentKey);
    res.json({ roundId: currentKey.split(":")[2], state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit trail for a round
router.get("/audit/:roundId", async (req, res) => {
  const round = await Round.findOne({ roundId: req.params.roundId });
  if (!round) return res.status(404).json({ error: "Round not found" });
  res.json(round);
});
// ✅ Paginated rounds list
router.get("/rounds", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const rounds = await Round.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Round.countDocuments();
    const totalPages = Math.ceil(total / limit);
    res.json({ page, totalPages, totalRounds: total, rounds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); // ✅ Bet list by userId
router.get("/bets/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const bets = await Bet.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Bet.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);
    res.json({ userId, page, totalPages, totalBets: total, bets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
