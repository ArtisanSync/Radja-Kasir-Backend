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

// All routes require authentication and active subscription
router.use(authenticateToken, requireSubscription);

// CRUD routes
router.post("/", createNewCategory);
router.get("/", getCategories);
router.get("/store/:storeId", getCategoriesByStoreId);
router.get("/:categoryId", getCategory);
router.put("/:categoryId", updateCategoryData);
router.delete("/:categoryId", removeCategoryData);

export default router;
