import express from "express";
import {
  createFirstStoreController,
  createNewStore,
  getMyStores,
  getStoreDetails,
  updateStoreDetails,
  deleteStoreById,
  getAllStoresAdmin,
} from "../controllers/storeController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeAdmin } from "../middlewares/roleMiddleware.js";
import { requireSubscription } from "../middlewares/subscriptionMiddleware.js";

const router = express.Router();

// Authentication required for all routes
router.use(authenticateToken);

router.post("/first", requireSubscription, createFirstStoreController);
router.post("/", requireSubscription, createNewStore);
router.get("/my-stores", requireSubscription, getMyStores);
router.get("/:storeId", requireSubscription, getStoreDetails);
router.put("/:storeId", requireSubscription, updateStoreDetails);
router.delete("/:storeId", requireSubscription, deleteStoreById);

// Admin only routes
router.get("/", authorizeAdmin, getAllStoresAdmin);

export default router;