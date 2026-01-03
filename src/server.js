import http from "http";
import { Server } from "socket.io";
import { port } from "./config/env.js";
import { connectDB } from "./config/db.js";
import redis from "./config/redis.js";
import { initScheduler } from "./services/scheduler.js";
import { initCountdown } from "./services/countdown.js";
import { initResultReveal } from "./services/resultReveal.js";
import app from "./app.js"; // ✅ import the app with routes

const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
connectDB();

// Initialize Scheduler
initScheduler(io);
initCountdown(io);
initResultReveal(io);

server.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
