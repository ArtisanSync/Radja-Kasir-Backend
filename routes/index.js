import express from "express";
import userRoutes from "./userRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import productRoutes from "./productRoutes.js";

const router = express.Router();

// Mount routes
router.use("/users", userRoutes);
router.use("/stores", storeRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;
