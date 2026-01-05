// src/services/resultReveal.js
import redis from "../config/redis.js";

export function initResultReveal(io) {
  setInterval(async () => {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) return;

    const state = await redis.hgetall(currentKey);
    if (!state?.end_ts || !state.id) return;

    const remainingMs = Number(state.end_ts) - Date.now();

    // Reveal only when countdown hits 0
    if (
      remainingMs <= 0 &&
      (state.status === "CLOSED" || state.status === "FORCED")
    ) {
      const roundId = state.id;

      // Prefer forced result if present
      const forcedFlag = await redis.get(`wingo:round:${roundId}:forced`);
      const resultKey = `wingo:round:${roundId}:result`;
      const resultJson = await redis.get(resultKey);
      if (!resultJson) return; // nothing frozen yet

      const result = JSON.parse(resultJson);

      // Emit final reveal
      io.emit("result-reveal", { roundId, result });

      // Update status to REVEALED and clear forced flag
      await redis.hset(currentKey, "status", "REVEALED");
      if (forcedFlag) {
        await redis.del(`wingo:round:${roundId}:forced`);
      }

      console.log("🎉 Result revealed:", roundId, resultJson);
    }
  }, 500); // check twice per second
}
