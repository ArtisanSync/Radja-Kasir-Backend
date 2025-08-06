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

const router = express.Router();

// Create first store (for new users)
router.post("/first", authenticateToken, createFirstStoreController);

// Protected routes
router.post("/", authenticateToken, createNewStore);
router.get("/my-stores", authenticateToken, getMyStores);
router.get("/:storeId", authenticateToken, getStoreDetails);
router.put("/:storeId", authenticateToken, updateStoreDetails);
router.delete("/:storeId", authenticateToken, deleteStoreById);

// Admin only routes
router.get("/", authenticateToken, authorizeAdmin, getAllStoresAdmin);

export default router;
