import redis from "../config/redis.js";
import { settleRound } from "./settlement.js";
import Round from "../models/Round.js";
import { selectResult } from "./resultEngine.js";

export function initResultReveal(io) {
  setInterval(async () => {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) return;

    const state = await redis.hgetall(currentKey);
    if (!state?.end_ts || !state.id) return;

    const roundId = state.id;
    const remainingMs = Number(state.end_ts) - Date.now();

    if (
      remainingMs <= 0 &&
      (state.status === "CLOSED" || state.status === "FORCED")
    ) {
      const revealLock = await redis.set(
        `wingo:locks:reveal:${roundId}`,
        "1",
        "NX",
        "EX",
        60
      );
      if (!revealLock) return;

      // Ensure result exists
      let resultJson = await redis.get(`wingo:round:${roundId}:result`);
      if (!resultJson) {
        console.warn(`⚠️ No frozen result for ${roundId}, computing now`);
        const computed = await selectResult(roundId);
        resultJson = JSON.stringify(computed);
      }
      const result = JSON.parse(resultJson);

      // Emit reveal
      io.emit("result-reveal", { roundId, result });

      // Update statuses
      await redis.hset(currentKey, "status", "REVEALED");
      await Round.updateOne(
        { roundId },
        { $set: { status: "REVEALED", result } }
      );
      await redis.del(`wingo:round:${roundId}:forced`);

      console.log("🎉 Result revealed:", roundId, result);

      // ✅ Settle immediately
      try {
        await settleRound(roundId, result);
        await Round.updateOne({ roundId }, { $set: { status: "SETTLED" } });
        console.log("✅ Round settled:", roundId);
      } catch (err) {
        console.error("❌ Settlement failed:", err);
        // Retry once
        setTimeout(async () => {
          try {
            await settleRound(roundId, result);
            await Round.updateOne({ roundId }, { $set: { status: "SETTLED" } });
            console.log("🔄 Retry successful → Round settled:", roundId);
          } catch (retryErr) {
            console.error("❌ Retry also failed:", retryErr);
          }
        }, 2000);
      }
    }
  }, 500);
}
