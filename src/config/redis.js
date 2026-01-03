import Redis from "ioredis";
import { redisUrl } from "./env.js";

const redis = new Redis(redisUrl);

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;
