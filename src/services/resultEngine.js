import redis from "../config/redis.js";

export async function selectResult(roundId) {
  // Respect forced result
  const forcedFlag = await redis.get(`wingo:round:${roundId}:forced`);
  if (forcedFlag) {
    const forcedResult = await redis.get(`wingo:round:${roundId}:result`);
    if (forcedResult) {
      console.log("⚠️ Admin forced result detected → using as final result");
      return JSON.parse(forcedResult);
    }
  }

  // 1) Read exposures
  const colorExp =
    (await redis.hgetall(`wingo:round:${roundId}:exposure:color`)) || {};
  const sizeExp =
    (await redis.hgetall(`wingo:round:${roundId}:exposure:size`)) || {};
  const numberExp =
    (await redis.hgetall(`wingo:round:${roundId}:exposure:number`)) || {};

  const toNum = (v) => Number(v || 0);

  const totalRed = toNum(colorExp.red);
  const totalGreen = toNum(colorExp.green);
  const totalViolet = toNum(colorExp.violet);
  const totalSmall = toNum(sizeExp.small);
  const totalBig = toNum(sizeExp.big);

  const numbersTotal = Array.from({ length: 10 }, (_, n) =>
    toNum(numberExp[String(n)])
  );
  const totalNumberBets = numbersTotal.reduce((a, b) => a + b, 0);

  // 2) Mode
  const modeRaw = await redis.get("wingo:admin:mode");
  const mode = modeRaw ? modeRaw.toUpperCase().trim() : "MAX_PROFIT";

  // 3) Violet rolling window (strict cap 10/100)
  const violetWindowKey = "wingo:stats:violet:last100";
  const arr = await redis.lrange(violetWindowKey, 0, -1);
  const violetCountLast100 = arr.reduce((sum, v) => sum + (Number(v) || 0), 0);

  // 4) Build candidates
  const candidates = [];
  for (let num = 0; num <= 9; num++) {
    let color = "RED";
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

    // Enforce violet cap
    if (includesViolet && violetCountLast100 >= 10) continue;

    candidates.push({ number: num, color, size, includesViolet });
  }

  // 5) Compute payout
  const computePayout = (c) => {
    let total = 0;
    if (c.color === "RED") total += totalRed * 2.0;
    if (c.color === "GREEN") total += totalGreen * 2.0;
    if (c.size === "SMALL") total += totalSmall * 2.0;
    if (c.size === "BIG") total += totalBig * 2.0;
    total += toNum(numberExp[String(c.number)]) * 9.0;
    if (c.includesViolet) {
      total += totalViolet * 4.5;
      if (c.color === "RED") total += totalRed * 1.5;
      if (c.color === "GREEN") total += totalGreen * 1.5;
    }
    return +total.toFixed(2);
  };

  const withPayouts = candidates.map((c) => ({
    candidate: c,
    payout: computePayout(c),
  }));

  let selected;

  // ✅ If no bets at all → random candidate
  if (
    totalNumberBets +
      totalRed +
      totalGreen +
      totalViolet +
      totalSmall +
      totalBig ===
    0
  ) {
    selected = withPayouts[Math.floor(Math.random() * withPayouts.length)];
    console.log(`🎲 No bets → random result chosen:`, selected);
  } else {
    // Normal selection by mode
    if (mode === "MAX_PROFIT") {
      selected = withPayouts.reduce((min, p) =>
        p.payout < min.payout ? p : min
      );
    } else {
      selected = withPayouts.reduce((max, p) =>
        p.payout > max.payout ? p : max
      );
    }
    console.log(`🎯 Mode=${mode} → Selected:`, selected);
  }

  // 6) Update counters
  await redis.incr("wingo:counters:rounds:count");
  await redis.lpush(
    violetWindowKey,
    selected.candidate.includesViolet ? "1" : "0"
  );
  await redis.ltrim(violetWindowKey, 0, 99);
  if (selected.candidate.includesViolet) {
    await redis.incr("wingo:counters:violet:count");
  }

  // 7) Freeze result
  const resultKey = `wingo:round:${roundId}:result`;
  const freeze = {
    ...selected.candidate,
    payout: selected.payout,
    freeze_ts: Date.now(),
    forced: false,
  };
  await redis.set(resultKey, JSON.stringify(freeze));

  return freeze;
}
