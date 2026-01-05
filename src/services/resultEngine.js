import redis from "../config/redis.js";

export async function selectResult(roundId) {
  // Read exposures
  const colorExp = await redis.hgetall(`wingo:round:${roundId}:exposure:color`);
  const sizeExp = await redis.hgetall(`wingo:round:${roundId}:exposure:size`);
  const numberExp = await redis.hgetall(
    `wingo:round:${roundId}:exposure:number`
  );

  const violetCount =
    Number(await redis.get("wingo:counters:violet:count")) || 0;
  const modeRaw = await redis.get("wingo:admin:mode");
  const mode = modeRaw ? modeRaw.toUpperCase().trim() : "MAX_PROFIT";

  // Explicit mapping for numbers 0–9
  const candidates = [];
  for (let num = 0; num <= 9; num++) {
    let color = null;
    let includesViolet = false;

    if (num === 0) {
      color = "RED";
      includesViolet = true;
    } else if ([1, 3, 7, 9].includes(num)) {
      color = "GREEN";
    } else if ([2, 4, 6, 8].includes(num)) {
      color = "RED";
    } else if (num === 5) {
      color = "GREEN";
      includesViolet = true;
    }

    const size = num <= 4 ? "SMALL" : "BIG";

    if (includesViolet && violetCount >= 10) continue; // enforce violet limit

    candidates.push({ number: num, color, size, includesViolet });
  }

  // Calculate payouts per candidate
  const payouts = candidates.map((c) => {
    let total = 0;

    // Color bets
    if (colorExp[c.color.toLowerCase()]) {
      total += Number(colorExp[c.color.toLowerCase()]) * 2.0;
    }

    // Size bets
    if (sizeExp[c.size.toLowerCase()]) {
      total += Number(sizeExp[c.size.toLowerCase()]) * 2.0;
    }

    // Number bets
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

  // Select result based on mode
  let selected;
  if (mode === "MAX_PROFIT") {
    selected = payouts.reduce((min, p) => (p.payout < min.payout ? p : min));
  } else {
    selected = payouts.reduce((max, p) => (p.payout > max.payout ? p : max));
  }

  // Freeze result in Redis
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
