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
import { requireSubscription } from "../middlewares/subscriptionMiddleware.js";
import { uploadSingle } from "../middlewares/multer.js";

const router = express.Router();

// Authentication required for all routes
router.use(authenticateToken);

router.get("/units", getUnits);

router.post("/", requireSubscription, uploadSingle("image"), createNewProduct);
router.get("/store/:storeId", requireSubscription, getProducts);
router.get("/:productId", requireSubscription, getProduct);
router.put("/:productId", requireSubscription, uploadSingle("image"), updateExistingProduct);
router.patch("/:productId/favorite", requireSubscription, toggleFavorite);
router.delete("/:productId", requireSubscription, removeProduct);

export default router;