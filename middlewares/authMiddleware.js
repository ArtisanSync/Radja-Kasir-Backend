import { verifyToken } from "../utils/jwt.js";
import { errorResponse } from "../utils/response.js";
import prisma from "../config/prisma.js";

// Authenticate token middleware
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return errorResponse(res, "Access token required", 401);
    }

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        avatar: true,
        isSubscribe: true,
      },
    });

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, "Invalid or expired token", 403);
  }
};
