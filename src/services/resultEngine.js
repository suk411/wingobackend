// src/services/resultEngine.js
import redis from "../config/redis.js";

export async function selectResult(roundId) {
  // Read exposures
  const colorExp = await redis.hgetall(`wingo:round:${roundId}:exposure:color`);
  const sizeExp = await redis.hgetall(`wingo:round:${roundId}:exposure:size`);
  const numberExp = await redis.hgetall(
    `wingo:round:${roundId}:exposure:number`
  );

  // Violet frequency check
  const violetCount =
    Number(await redis.get("wingo:counters:violet:count")) || 0;
  const mode = (await redis.get("wingo:admin:mode")) || "MAX_PROFIT";

  // Build candidate results (0–9)
  const candidates = [];
  for (let num = 0; num <= 9; num++) {
    const color = num % 2 === 0 ? "GREEN" : "RED";
    const size = num <= 4 ? "SMALL" : "BIG";
    const includesViolet = num === 0 || num === 5;
    if (includesViolet && violetCount >= 10) continue; // enforce violet limit
    candidates.push({ number: num, color, size, includesViolet });
  }

  // Calculate payouts per candidate
  const payouts = candidates.map((c) => {
    let total = 0;

    // Color
    if (colorExp[c.color.toLowerCase()]) {
      total += Number(colorExp[c.color.toLowerCase()]) * 2.0;
    }

    // Size
    if (sizeExp[c.size.toLowerCase()]) {
      total += Number(sizeExp[c.size.toLowerCase()]) * 2.0;
    }

    // Number
    if (numberExp[String(c.number)]) {
      total += Number(numberExp[String(c.number)]) * 9.0;
    }

    // Violet adjuncts
    if (c.includesViolet) {
      if (colorExp["violet"]) total += Number(colorExp["violet"]) * 4.5;
      if (c.color === "RED" && colorExp["red"])
        total += Number(colorExp["red"]) * 1.5;
      if (c.color === "GREEN" && colorExp["green"])
        total += Number(colorExp["green"]) * 1.5;
    }

    return { candidate: c, payout: +total.toFixed(2) };
  });

  // Select result
  let selected;
  if (mode === "MAX_PROFIT") {
    selected = payouts.reduce((min, p) => (p.payout < min.payout ? p : min));
  } else {
    selected = payouts.reduce((max, p) => (p.payout > max.payout ? p : max));
  }

  // Freeze result
  const resultKey = `wingo:round:${roundId}:result`;
  const freeze = {
    ...selected.candidate,
    payout: selected.payout,
    freeze_ts: Date.now(),
  };
  await redis.set(resultKey, JSON.stringify(freeze), "NX");

  console.log("✅ Result frozen:", freeze);
  return freeze;
}
