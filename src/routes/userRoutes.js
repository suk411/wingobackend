import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Bet from "../models/Bet.js";
import Round from "../models/Round.js";
import redis from "../config/redis.js";
import { placeBet } from "../services/betting.js";

const router = Router();

/* ---------------- AUTH ---------------- */

// Register
router.post("/register", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const user = new User({ username, password });
    await user.save();

    // Create wallet for new user
    await Wallet.create({ userId: user._id, balance: 5000, locked: 0 });

    res.json({ message: "User registered successfully", userId: user._id });
  } catch (err) {
    next(err);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

/* ---------------- WALLET ---------------- */

// Wallet balance
router.get("/wallet", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const wallet = await Wallet.findOne({ userId: decoded.userId });

    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    res.json({ balance: wallet.balance, locked: wallet.locked });
  } catch (err) {
    next(err);
  }
});

/* ---------------- BETS ---------------- */

// Place bet
router.post("/bet", async (req, res) => {
  try {
    const { roundId, bets } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!roundId || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const betIds = await placeBet({ userId, roundId, bets });
    res.json({ roundId, betIds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get own bets (paginated)
router.get("/bets", async (req, res) => {
  try {
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

/* ---------------- ROUNDS ---------------- */

// Live round details
router.get("/round/live", async (req, res) => {
  try {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) {
      return res.status(404).json({ error: "No active round" });
    }

    const state = await redis.hgetall(currentKey);
    res.json({
      roundId: currentKey.split(":")[2],
      start_ts: state.start_ts,
      end_ts: state.end_ts,
      status: state.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Last 10 rounds history
router.get("/rounds/history", async (req, res) => {
  try {
    const rounds = await Round.find({}).sort({ createdAt: -1 }).limit(10);

    const history = rounds.map((r) => ({
      roundId: r.roundId,
      result: r.result,
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
