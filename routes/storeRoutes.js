import express from "express";
import {
  createNewStore,
  getMyStores,
  getStoreDetails,
  updateStoreDetails,
  deleteStoreById,
  getAllStoresAdmin,
} from "../controllers/storeController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  requireSubscription,
  requireAdminOrSubscription,
} from "../middlewares/subscriptionMiddleware.js";
import { authorizeAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Protected routes - require authentication and subscription
router.post("/", authenticateToken, requireSubscription, createNewStore);
router.get("/my-stores", authenticateToken, requireSubscription, getMyStores);
router.get(
  "/:storeId",
  authenticateToken,
  requireAdminOrSubscription,
  getStoreDetails
);
router.put(
  "/:storeId",
  authenticateToken,
  requireAdminOrSubscription,
  updateStoreDetails
);
router.delete(
  "/:storeId",
  authenticateToken,
  requireAdminOrSubscription,
  deleteStoreById
);

// Admin only routes
router.get("/", authenticateToken, authorizeAdmin, getAllStoresAdmin);

export default router;
