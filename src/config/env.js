import dotenv from "dotenv";
dotenv.config();

export const port = process.env.PORT;
export const mongoUri = process.env.MONGO_URI;
export const redisUrl = process.env.REDIS_URL;
export const jwtSecret = process.env.JWT_SECRET;
