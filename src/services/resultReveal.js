// src/services/resultReveal.js
import redis from "../config/redis.js";

export function initResultReveal(io) {
  setInterval(async () => {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) return;

    const state = await redis.hgetall(currentKey);
    if (!state?.end_ts || !state.id) return;

    const remainingMs = Number(state.end_ts) - Date.now();

    // When countdown hits 0, reveal result
    if (remainingMs <= 0 && state.status === "CLOSED") {
      const resultKey = `wingo:round:${state.id}:result`;
      const result = await redis.get(resultKey);
      if (!result) return; // nothing frozen yet

      io.emit("result-reveal", {
        roundId: state.id,
        result: JSON.parse(result),
      });

      // Update status to REVEALED
      await redis.hset(currentKey, "status", "REVEALED");
      console.log("🎉 Result revealed:", state.id, result);
    }
  }, 500); // check twice per second
}
