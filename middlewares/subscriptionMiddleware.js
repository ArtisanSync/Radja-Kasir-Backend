import { errorResponse } from "../utils/response.js";
import { hasActiveSubscription } from "../services/subscriptionService.js";

// Check if user has active subscription
export const requireSubscription = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  const hasSubscription = await hasActiveSubscription(req.user.id);

  if (!hasSubscription) {
    return errorResponse(
      res,
      "Active subscription required to access this feature",
      403
    );
  }

  next();
};

// Check if user is admin or has subscription
export const requireAdminOrSubscription = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  if (req.user.role === "ADMIN") {
    return next();
  }

  const hasSubscription = await hasActiveSubscription(req.user.id);

  if (!hasSubscription) {
    return errorResponse(
      res,
      "Admin role or active subscription required to access this feature",
      403
    );
  }

  next();
};