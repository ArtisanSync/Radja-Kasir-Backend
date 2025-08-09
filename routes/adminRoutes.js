import express from "express";
import {
  getAllActiveSubscribers,
  changeUserSubscription,
  extendUserSubscription,
  removeUserAccount,
  removeStoreMember,
  getDashboardStats,
} from "../controllers/adminController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeAdmin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// User management
router.get("/subscribers", getAllActiveSubscribers);
router.delete("/users/:userId", removeUserAccount);

// Subscription management
router.put("/users/:userId/subscription", changeUserSubscription);
router.put("/users/:userId/extend", extendUserSubscription);

// Member management
router.delete("/members/:memberId", removeStoreMember);

export default router;