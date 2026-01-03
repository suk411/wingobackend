// src/services/scheduler.js
import cron from "node-cron";
import redis from "../config/redis.js";
import { RoundStatus } from "../constants/enums.js";

export function initScheduler(io) {
  // Run every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    // Acquire lock so only one scheduler runs
    const lock = await redis.set("wingo:locks:scheduler", "1", "NX", "EX", 10);
    if (!lock) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}${mm}${dd}`;

    // Redis counter per day
    const counterKey = `wingo:roundCounter:${dateKey}`;
    const seq = await redis.incr(counterKey);
    await redis.expire(counterKey, 86400); // expire after 24h

    // Round ID format: YYYYMMDD00001
    const roundId = `${dateKey}${String(seq).padStart(5, "0")}`;

    const startTs = Date.now();
    const endTs = startTs + 30000; // 30s later

    // ✅ Store round state in Redis
    await redis.hset(`wingo:round:${roundId}:state`, {
      id: roundId,
      start_ts: startTs,
      end_ts: endTs,
      status: RoundStatus.BETTING,
    });

    // ✅ Pointer to current round for countdown/betting services
    await redis.set("wingo:round:current", `wingo:round:${roundId}:state`);

    // ✅ Broadcast round-start event
    io.emit("round-start", { roundId, endTs });
    console.log("🎯 Round created:", roundId);
  });
}
