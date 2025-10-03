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
import { uploadSingle } from "../middlewares/multer.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/first", requireSubscription, uploadSingle('logo'), createFirstStoreController);
router.post("/", requireSubscription, uploadSingle('logo'), createNewStore);
router.post("/:storeId", requireSubscription, uploadSingle('logo'), updateStoreDetails);
router.get("/my-stores", requireSubscription, getMyStores);
router.get("/:storeId", requireSubscription, getStoreDetails);
router.delete("/:storeId", requireSubscription, deleteStoreById);

// Admin only routes
router.get("/", authorizeAdmin, getAllStoresAdmin);

export default router;