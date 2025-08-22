import { errorResponse } from "../utils/response.js";
import { checkSubscriptionStatus } from "../services/subscriptionService.js";

// Check if user has active subscription
export const requireSubscription = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }
  if (req.user.role === "ADMIN") {
    return next();
  }

  try {
    const subscriptionStatus = await checkSubscriptionStatus(req.user.id);

    if (!subscriptionStatus.hasAccess) {
      return errorResponse(
        res,
        "Active subscription required to access this feature. Please subscribe to continue.",
        403,
        {
          subscriptionRequired: true,
          currentStatus: subscriptionStatus.status,
          message: subscriptionStatus.message
        }
      );
    }

    req.subscription = subscriptionStatus.subscription;
    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    return errorResponse(res, "Failed to verify subscription status", 500);
  }
};

export const requireAdminOrSubscription = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  if (req.user.role === "ADMIN") {
    return next();
  }

  try {
    const subscriptionStatus = await checkSubscriptionStatus(req.user.id);

    if (!subscriptionStatus.hasAccess) {
      return errorResponse(
        res,
        "Admin role or active subscription required to access this feature",
        403,
        {
          subscriptionRequired: true,
          currentStatus: subscriptionStatus.status
        }
      );
    }

    req.subscription = subscriptionStatus.subscription;
    next();
  } catch (error) {
    console.error("Admin or subscription check error:", error);
    return errorResponse(res, "Failed to verify access permissions", 500);
  }
};