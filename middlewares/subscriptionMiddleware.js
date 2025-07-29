import { errorResponse } from "../utils/response.js";

// Check if user has active subscription
export const requireSubscription = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  if (!req.user.isSubscribe) {
    return errorResponse(
      res,
      "Active subscription required to access this feature",
      403
    );
  }

  next();
};

// Check if user is admin or has subscription
export const requireAdminOrSubscription = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  if (req.user.role !== "ADMIN" && !req.user.isSubscribe) {
    return errorResponse(
      res,
      "Admin role or active subscription required to access this feature",
      403
    );
  }

  next();
};
