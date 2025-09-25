import { errorResponse } from "../utils/response.js";
import { checkSubscriptionStatus } from "../services/subscriptionService.js";
import prisma from "../config/prisma.js";

export const requireSubscription = async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "User not authenticated", 401);
  }

  // Jika ADMIN, langsung lolos
  if (req.user.role === "ADMIN") {
    return next();
  }

  let userIdToCheck = req.user.id;
  if (req.user.role === "MEMBER") {
    const storeMember = await prisma.storeMember.findFirst({
      where: { userId: req.user.id },
      select: { store: { select: { userId: true } } }
    });
    
    if (storeMember && storeMember.store) {
      userIdToCheck = storeMember.store.userId;
      console.log(`Member access: Checking subscription for owner ID: ${userIdToCheck}`);
    } else {
      return errorResponse(res, "Member is not associated with any store.", 403);
    }
  }

  try {
    const subscriptionStatus = await checkSubscriptionStatus(userIdToCheck);

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