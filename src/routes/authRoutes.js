import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import Wallet from "../models/Wallet.js";
const router = Router();

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
    next(err); // ✅ forward to error handler
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

export default router;
