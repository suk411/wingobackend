import { Router } from "express";
import mongoose from "mongoose";
import redis from "../config/redis.js";

const router = Router();

router.get("/", async (req, res) => {
  res.json({
    status: "OK",
    mongo: mongoose.connection.readyState === 1 ? "UP" : "DOWN",
    redis: redis.status === "ready" ? "UP" : "DOWN",
  });
});

export default router;
