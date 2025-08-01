import express from "express";
import {
  createNewProduct,
  getProducts,
  getProduct,
  updateExistingProduct,
  toggleFavorite,
  removeProduct,
  getUnits,
} from "../controllers/productController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { uploadSingle } from "../middlewares/multer.js";

const router = express.Router();

// Get units (for dropdown)
router.get("/units", authenticateToken, getUnits);

// Product routes
router.post("/", authenticateToken, uploadSingle("image"), createNewProduct);
router.get("/store/:storeId", authenticateToken, getProducts);
router.get("/:productId", authenticateToken, getProduct);
router.put("/:productId", authenticateToken, uploadSingle("image"), updateExistingProduct);
router.patch("/:productId/favorite", authenticateToken, toggleFavorite);
router.delete("/:productId", authenticateToken, removeProduct);

export default router;