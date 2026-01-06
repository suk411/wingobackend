import { Router } from "express";
import redis from "../config/redis.js";
import Round from "../models/Round.js";
import Bet from "../models/Bet.js";
import Ledger from "../models/Ledger.js";
import { selectResult } from "../services/resultEngine.js";

const router = Router();

// Force result manually (only for active round)
router.post("/force-result", async (req, res) => {
  try {
    const { roundId, number } = req.body;
    if (!roundId || number === undefined) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) {
      return res.status(400).json({ error: "No active round" });
    }
    const activeRoundId = currentKey.split(":")[2];
    if (roundId !== activeRoundId) {
      return res.status(400).json({
        error: "Can only force result for active round",
        activeRoundId,
      });
    }

    // Use same canonical mapping as engine
    let color = "RED";
    let includesViolet = false;
    if (number === 0) {
      color = "RED";
      includesViolet = true;
    } else if ([1, 3, 7, 9].includes(number)) {
      color = "GREEN";
    } else if ([2, 4, 6, 8].includes(number)) {
      color = "RED";
    } else if (number === 5) {
      color = "GREEN";
      includesViolet = true;
    }

    const size = number <= 4 ? "SMALL" : "BIG";

    const result = {
      number,
      color,
      size,
      includesViolet,
      payout: 0,
      freeze_ts: Date.now(),
      forced: true,
    };

    await redis.set(`wingo:round:${roundId}:result`, JSON.stringify(result));
    await redis.set(`wingo:round:${roundId}:forced`, "true");
    await redis.hset(`wingo:round:${roundId}:state`, "status", "FORCED");

    await Round.updateOne(
      { roundId },
      { $set: { result, status: "FORCED" } },
      { upsert: true }
    );

    res.json({ roundId, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle admin mode (MAX_PROFIT / MAX_LOSS)
router.post("/mode", async (req, res) => {
  let { mode } = req.body;
  mode = mode.toUpperCase().trim();
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

// Current round snapshot with details
router.get("/round/current", async (req, res) => {
  try {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) {
      return res.status(404).json({ error: "No active round" });
    }

    const state = await redis.hgetall(currentKey);
    const roundId = currentKey.split(":")[2];

    const bets = await Bet.find({ roundId });
    const totalBets = bets.reduce((sum, b) => sum + b.amount, 0);

    const betsByColor = bets.reduce((acc, b) => {
      if (b.type === "COLOR") {
        acc[String(b.option).toUpperCase()] =
          (acc[String(b.option).toUpperCase()] || 0) + b.amount;
      }
      return acc;
    }, {});

    const betsBySize = bets.reduce((acc, b) => {
      if (b.type === "SIZE") {
        acc[String(b.option).toUpperCase()] =
          (acc[String(b.option).toUpperCase()] || 0) + b.amount;
      }
      return acc;
    }, {});

    const betsByNumber = bets.reduce((acc, b) => {
      if (b.type === "NUMBER") {
        acc[b.option] = (acc[b.option] || 0) + b.amount;
      }
      return acc;
    }, {});

    const roundDoc = await Round.findOne({ roundId });
    const result = roundDoc ? roundDoc.result : null;

    res.json({
      roundId,
      state,
      totalBets,
      betsByColor,
      betsBySize,
      betsByNumber,
      result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paginated rounds list with totals
router.get("/rounds", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const rounds = await Round.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enrichedRounds = await Promise.all(
      rounds.map(async (round) => {
        const bets = await Bet.find({ roundId: round.roundId });
        const totalBets = bets.reduce((sum, b) => sum + b.amount, 0);

        const credits = await Ledger.find({
          roundId: round.roundId,
          type: "CREDIT",
        });
        const totalPayout = credits.reduce((sum, l) => sum + l.amount, 0);

        const fees = await Ledger.find({ roundId: round.roundId, type: "FEE" });
        const totalFees = fees.reduce((sum, l) => sum + l.amount, 0);

        const profit = totalBets - totalPayout + totalFees;

        return {
          ...round.toObject(),
          totalBets,
          totalPayout,
          totalFees,
          profit,
        };
      })
    );

    const total = await Round.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.json({
      page,
      totalPages,
      totalRounds: total,
      rounds: enrichedRounds,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bet list by userId with pagination
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
