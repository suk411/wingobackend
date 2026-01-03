// src/app.js
import express from "express";
import betRoutes from "./routes/betRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(express.json());
app.use("/api", betRoutes);
app.use("/admin", adminRoutes);
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
export default app;
