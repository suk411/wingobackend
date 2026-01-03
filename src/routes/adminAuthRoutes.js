import { Router } from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const router = Router();

// Register Admin
router.post("/register", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Admin username already taken" });
    }

    const admin = new Admin({ username, password });
    await admin.save();

    res.json({
      message: "Admin registered successfully",
      adminId: admin._id,
    });
  } catch (err) {
    next(err);
  }
});

// Login Admin
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ error: "Invalid credentials" });

    const match = await admin.comparePassword(password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { adminId: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, adminId: admin._id });
  } catch (err) {
    next(err);
  }
});

export default router;
