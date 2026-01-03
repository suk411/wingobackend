// src/app.js
import express from "express";
import betRoutes from "./routes/betRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";

const app = express();
app.use(express.json());
app.use("/api", betRoutes);
app.use("/admin", adminRoutes);
app.use("/health", healthRoutes);
export default app;
