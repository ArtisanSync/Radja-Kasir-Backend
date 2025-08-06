import express from "express";
import {
  getPackages,
  getUserSubscription,
  getSubscriptionStatus,
} from "../controllers/subscriptionController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/packages", getPackages);

// Protected routes
router.get("/my-subscription", authenticateToken, getUserSubscription);
router.get("/status", authenticateToken, getSubscriptionStatus);

export default router;
