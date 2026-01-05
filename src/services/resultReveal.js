import redis from "../config/redis.js";

export function initResultReveal(io) {
  setInterval(async () => {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) return;

    const state = await redis.hgetall(currentKey);
    if (!state?.end_ts || !state.id) return;

    const roundId = state.id;
    const remainingMs = Number(state.end_ts) - Date.now();

    // Reveal only when countdown hits 0 and status is CLOSED or FORCED
    if (
      remainingMs <= 0 &&
      (state.status === "CLOSED" || state.status === "FORCED")
    ) {
      const resultKey = `wingo:round:${roundId}:result`;
      const forcedFlagKey = `wingo:round:${roundId}:forced`;

      const resultJson = await redis.get(resultKey);
      if (!resultJson) return; // nothing frozen yet

      const result = JSON.parse(resultJson);

      // Emit final reveal
      io.emit("result-reveal", { roundId, result });

      // Update status to REVEALED and clear forced flag
      await redis.hset(currentKey, "status", "REVEALED");
      const forcedFlag = await redis.get(forcedFlagKey);
      if (forcedFlag) {
        await redis.del(forcedFlagKey);
      }

      console.log("🎉 Result revealed:", roundId, resultJson);
    }
  }, 500); // check twice per second
}
