import cron from "node-cron";
import redis from "../config/redis.js";
import { RoundStatus } from "../constants/enums.js";
import { createRound } from "./round.js";
import { selectResult } from "./resultEngine.js"; // use engine for non-forced rounds

export function initScheduler(io) {
  cron.schedule("*/30 * * * * *", async () => {
    const lock = await redis.set("wingo:locks:scheduler", "1", "NX", "EX", 10);
    if (!lock) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}${mm}${dd}`;

    const counterKey = `wingo:roundCounter:${dateKey}`;
    const seq = await redis.incr(counterKey);
    await redis.expire(counterKey, 86400);

    const roundId = `${dateKey}${String(seq).padStart(5, "0")}`;
    const startTs = Date.now();
    const endTs = startTs + 30000;

    // Initialize state
    const stateKey = `wingo:round:${roundId}:state`;
    await redis.hset(stateKey, {
      id: roundId,
      start_ts: startTs,
      end_ts: endTs,
      status: RoundStatus.BETTING,
    });
    await redis.set("wingo:round:current", stateKey);

    // Persist in Mongo
    await createRound(roundId, startTs, endTs);

    io.emit("round-start", { roundId, endTs });
    console.log("🎯 Round created:", roundId);

    // Guarded close logic at end of round:
    setTimeout(async () => {
      // Set CLOSED; result will be revealed by resultReveal when end_ts passes
      const lockClose = await redis.set(
        `wingo:locks:auto-close:${roundId}`,
        "1",
        "NX",
        "EX",
        10
      );
      if (!lockClose) return;

      const currentKey = await redis.get("wingo:round:current");
      if (currentKey) {
        const state = await redis.hgetall(currentKey);
        if (state?.id === roundId) {
          await redis.hset(currentKey, "status", RoundStatus.CLOSED);
          io.emit("bet-closed", { roundId });
        }
      }

      // If admin forced, DO NOT compute; ensure result exists
      const forced = await redis.get(`wingo:round:${roundId}:forced`);
      if (forced) {
        const forcedJson = await redis.get(`wingo:round:${roundId}:result`);
        if (!forcedJson) {
          console.warn(
            `⚠️ Forced flag present but no result frozen for ${roundId}`
          );
        }
        // Let resultReveal handle emit and status → REVEALED
        return;
      }

      // Normal case: compute and freeze via engine, do not emit or settle here
      await selectResult(roundId);

      // Result will be revealed by resultReveal after countdown hits zero.
    }, 30000);
  });
}
