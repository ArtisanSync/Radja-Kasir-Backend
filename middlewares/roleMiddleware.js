import { errorResponse } from "../utils/response.js";

// Authorize specific roles
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "User not authenticated", 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        "Access denied - insufficient permissions",
        403
      );
    }

    next();
  };
};

// Admin only access
export const authorizeAdmin = authorizeRoles("ADMIN");

// Admin or User access
export const authorizeAdminOrUser = authorizeRoles("ADMIN", "USER");

// Member access
export const authorizeMember = authorizeRoles("MEMBER");
