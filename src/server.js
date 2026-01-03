import express from "express";
import http from "http";
import { Server } from "socket.io";
import { port } from "./config/env.js";
import { connectDB } from "./config/db.js";
import redis from "./config/redis.js";
import { initScheduler } from "./services/scheduler.js";
import { initCountdown } from "./services/countdown.js";
import { initResultReveal } from "./services/resultReveal.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
connectDB();
// Initialize Scheduler
initScheduler(io);
initCountdown(io);
initResultReveal(io);

app.get("/", (req, res) => res.send("Wingo backend running"));

server.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
