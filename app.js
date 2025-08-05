import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/_health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/v1", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Radja Kasir API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Test route works!",
    port: PORT,
    env: process.env.NODE_ENV || "development",
  });
});

// 404 handler
app.use("/*splat", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error stack:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Test: http://localhost:${PORT}/test`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
  console.log(`🏥 Health: http://localhost:${PORT}/_health`);
});

export default app;
