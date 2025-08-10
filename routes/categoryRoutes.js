import express from "express";
import {
  createNewCategory,
  getCategories,
  getCategoriesByStoreId,
  getCategory,
  updateCategoryData,
  removeCategoryData,
} from "../controllers/categoryController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { requireSubscription } from "../middlewares/subscriptionMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", requireSubscription, createNewCategory);
router.get("/", requireSubscription, getCategories);
router.get("/store/:storeId", requireSubscription, getCategoriesByStoreId);
router.get("/:categoryId", requireSubscription, getCategory);
router.put("/:categoryId", requireSubscription, updateCategoryData);
router.delete("/:categoryId", requireSubscription, removeCategoryData);

export default router;