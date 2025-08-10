import express from "express";
import {
  createInvite,
  acceptInvite,
  getInvites,
  revokeInviteCode,
  getMembers,
  removeMemberFromStore,
} from "../controllers/inviteController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { requireSubscription } from "../middlewares/subscriptionMiddleware.js";

const router = express.Router();

router.post("/accept", acceptInvite);

router.use(authenticateToken);

router.post("/", requireSubscription, createInvite);
router.get("/store/:storeId", requireSubscription, getInvites);
router.delete("/:inviteId", requireSubscription, revokeInviteCode);

// Member management requires subscription
router.get("/store/:storeId/members", requireSubscription, getMembers);
router.delete("/store/:storeId/members/:memberId", requireSubscription, removeMemberFromStore);

export default router;