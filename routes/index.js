import express from "express";
import userRoutes from "./userRoutes.js";

const router = express.Router();

// Mount user routes
router.use("/auth", userRoutes);
router.use("/users", userRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;
