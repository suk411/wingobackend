import cron from "node-cron";
import redis from "../config/redis.js";
import { RoundStatus } from "../constants/enums.js";
import { createRound, closeRound } from "./round.js";
import { settleRound } from "./settlement.js";

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

    await redis.hset(`wingo:round:${roundId}:state`, {
      id: roundId,
      start_ts: startTs,
      end_ts: endTs,
      status: RoundStatus.BETTING,
    });
    await redis.set("wingo:round:current", `wingo:round:${roundId}:state`);

    await createRound(roundId, startTs, endTs);

    io.emit("round-start", { roundId, endTs });
    console.log("🎯 Round created:", roundId);

    setTimeout(async () => {
      const number = Math.floor(Math.random() * 10);
      let color;
      let includesViolet = false;

      if (number === 0) {
        color = "RED";
        includesViolet = true;
      } else if ([1, 3, 7, 9].includes(number)) {
        color = "GREEN";
      } else if ([2, 4, 6, 8].includes(number)) {
        color = "RED";
      } else if (number === 5) {
        color = "GREEN";
        includesViolet = true;
      }

      const size = number <= 4 ? "SMALL" : "BIG";
      const result = { number, color, size, includesViolet };

      await closeRound(roundId, result);
      await settleRound(roundId, result);

      io.emit("round-end", { roundId, result });
      console.log("✅ Round settled:", roundId, result);
    }, 30000);
  });
}
