import cron from "node-cron";
import redis from "../config/redis.js";
import { RoundStatus } from "../constants/enums.js";
import { createRound } from "./round.js";
import { selectResult } from "./resultEngine.js";
import { settleRound } from "./settlement.js";
import Round from "../models/Round.js";
import Bet from "../models/Bet.js";

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

    // Initialize state in Redis
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

    // Close betting and freeze result after 30s
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
          console.log(`🔒 Round ${roundId} closed`);
        }
      }

      // If admin forced, skip compute
      const forced = await redis.get(`wingo:round:${roundId}:forced`);
      if (forced) {
        const forcedJson = await redis.get(`wingo:round:${roundId}:result`);
        if (!forcedJson) {
          console.warn(
            `⚠️ Forced flag present but no result frozen for ${roundId}`
          );
        }
        return;
      }

      // Normal case: compute and freeze result
      const result = await selectResult(roundId);
      if (!result) {
        console.error(`❌ Failed to freeze result for ${roundId}`);
      } else {
        console.log(`🧊 Result frozen for ${roundId}:`, result);
      }
      // Reveal + settlement handled by resultReveal
    }, 30000);
  });

  // ✅ Guard sweep every minute: settle any stuck rounds
  cron.schedule("*/1 * * * *", async () => {
    const stuckRounds = await Round.find({
      status: { $in: ["CLOSED", "REVEALED"] },
    });
    for (const r of stuckRounds) {
      const pendingBets = await Bet.countDocuments({
        roundId: r.roundId,
        status: "PENDING",
      });
      if (pendingBets === 0) continue;

      const resultJson = await redis.get(`wingo:round:${r.roundId}:result`);
      if (!resultJson) {
        console.warn(`⚠️ Guard: no result frozen for ${r.roundId}`);
        continue;
      }
      const result = JSON.parse(resultJson);

      try {
        await settleRound(r.roundId, result);
        await Round.updateOne(
          { roundId: r.roundId },
          { $set: { status: "SETTLED" } }
        );
        console.log(`✅ Guard settled round ${r.roundId}`);
      } catch (err) {
        console.error(`❌ Guard failed to settle round ${r.roundId}:`, err);
      }
    }
  });
}
