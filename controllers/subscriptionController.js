import { successResponse, errorResponse } from "../utils/response.js";
import {
  getAllPackages,
  getUserActiveSubscription,
  checkSubscriptionStatus,
} from "../services/subscriptionService.js";

// Get all packages
export const getPackages = async (req, res) => {
  try {
    const packages = await getAllPackages();
    return successResponse(res, packages, "Packages retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get user subscription
export const getUserSubscription = async (req, res) => {
  try {
    const subscription = await getUserActiveSubscription(req.user.id);
    return successResponse(res, subscription, "Subscription retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Check subscription status
export const getSubscriptionStatus = async (req, res) => {
  try {
    const status = await checkSubscriptionStatus(req.user.id);
    return successResponse(res, status, "Subscription status retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
