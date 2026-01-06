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
      // Single-execution lock for reveal
      const revealLock = await redis.set(
        `wingo:locks:reveal:${roundId}`,
        "1",
        "NX",
        "EX",
        60
      );
      if (!revealLock) return;

      // Ensure result exists: if missing, compute now
      const resultKey = `wingo:round:${roundId}:result`;
      let resultJson = await redis.get(resultKey);
      if (!resultJson) {
        console.warn(
          `⚠️ Reveal: no frozen result for ${roundId} → computing via engine`
        );
        const computed = await selectResult(roundId);
        if (!computed) {
          console.error(`❌ Reveal: selectResult failed for ${roundId}`);
          return;
        }
        resultJson = await redis.get(resultKey);
        if (!resultJson) {
          console.error(
            `❌ Reveal: result still missing after compute for ${roundId}`
          );
          return;
        }
      }

      const result = JSON.parse(resultJson);

      // Emit final reveal
      io.emit("result-reveal", { roundId, result });

      // Update statuses
      await redis.hset(currentKey, "status", "REVEALED");
      await Round.updateOne(
        { roundId },
        { $set: { status: "REVEALED", result } }
      );
      await redis.del(`wingo:round:${roundId}:forced`);

      console.log("🎉 Result revealed:", roundId, result);

      // Immediately settle and finalize round
      try {
        await settleRound(roundId, result);
        await Round.updateOne({ roundId }, { $set: { status: "SETTLED" } });
        console.log("✅ Round settled:", roundId);
      } catch (err) {
        console.error("❌ Settlement failed:", err);
        // Retry once after 2 seconds
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
