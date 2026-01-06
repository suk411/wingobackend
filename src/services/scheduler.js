import cron from "node-cron";
import redis from "../config/redis.js";
import { RoundStatus } from "../constants/enums.js";
import { createRound } from "./round.js";
import { selectResult } from "./resultEngine.js";
import { settleRound } from "./settlement.js";
import Round from "../models/Round.js";

export function initScheduler(io) {
  // Create a new round every 30s
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

    await createRound(roundId, startTs, endTs);

    io.emit("round-start", { roundId, endTs });
    console.log(`🚀 Round started: ${roundId}`);

    // At T‑25s (5s before end), close betting and freeze result
    setTimeout(async () => {
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
          console.log(`🔒 Round closed: ${roundId}`);
        }
      }

      // If forced, skip compute
      const forced = await redis.get(`wingo:round:${roundId}:forced`);
      if (forced) {
        console.log(
          `⚠️ Round ${roundId} forced by admin, skipping auto compute`
        );
        return;
      }

      // Compute and freeze result according to mode
      const result = await selectResult(roundId);
      if (result) {
        console.log(`🧊 Result frozen at T‑5s for ${roundId}:`, result);
      } else {
        console.error(`❌ Failed to freeze result for ${roundId}`);
      }
    }, 25000); // 25s after start → 5s before end

    // At T=30s, reveal and settle
    setTimeout(async () => {
      const resultJson = await redis.get(`wingo:round:${roundId}:result`);
      if (!resultJson) {
        console.error(`❌ No result found at reveal for ${roundId}`);
        return;
      }
      const result = JSON.parse(resultJson);

      io.emit("result-reveal", { roundId, result });
      await redis.hset(stateKey, "status", RoundStatus.REVEALED);
      await Round.updateOne(
        { roundId },
        { $set: { status: "REVEALED", result } }
      );
      console.log(`🎉 Result revealed: ${roundId}`, result);

      try {
        await settleRound(roundId, result);
        await Round.updateOne({ roundId }, { $set: { status: "SETTLED" } });
        console.log(`✅ Round settled: ${roundId}`);
      } catch (err) {
        console.error(`❌ Settlement failed for ${roundId}:`, err);
      }
    }, 30000);
  });
}
