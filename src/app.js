// src/app.js
import express from "express";
import betRoutes from "./routes/betRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
const app = express();
app.use(express.json());
app.use("/api", betRoutes);
app.use("/admin", adminRoutes);
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/api", walletRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({ error: err.message });
});

export default app;
