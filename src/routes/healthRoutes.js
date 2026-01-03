// src/routes/healthRoutes.js
import { Router } from "express";
import mongoose from "mongoose";
import redis from "../config/redis.js";

const router = Router();

router.get("/health", async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "UP" : "DOWN";
  try {
    await redis.ping();
    res.json({ status: "OK", mongo: mongoStatus, redis: "UP" });
  } catch {
    res.json({ status: "DEGRADED", mongo: mongoStatus, redis: "DOWN" });
  }
});

export default router;
