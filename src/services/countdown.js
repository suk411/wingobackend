import redis from "../config/redis.js";

export function initCountdown(io) {
  setInterval(async () => {
    const currentKey = await redis.get("wingo:round:current");
    if (!currentKey) return;

    const state = await redis.hgetall(currentKey);
    if (!state?.end_ts || !state.id) return;

    const remainingMs = Number(state.end_ts) - Date.now();
    if (remainingMs < 0) return;

    // Broadcast countdown
    io.emit("countdown", { roundId: state.id, remainingMs });

    // Close betting at <= 5000ms
    if (remainingMs <= 5000 && state.status === "BETTING") {
      const closedLock = await redis.set(
        `wingo:locks:close:${state.id}`,
        "1",
        "NX",
        "EX",
        10
      );
      if (closedLock) {
        await redis.hset(currentKey, "status", "CLOSED");
        io.emit("bet-closed", { roundId: state.id });
        console.log("🔒 Betting closed:", state.id);
      }
    }
  }, 1000);
}
