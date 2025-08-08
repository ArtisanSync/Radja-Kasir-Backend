// routes/inviteRoutes.js
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

const router = express.Router();

// Public routes
router.post("/accept", acceptInvite);
router.use(authenticateToken);

// Invitation management
router.post("/", createInvite);
router.get("/store/:storeId", getInvites);
router.delete("/:inviteId", revokeInviteCode);

// Member management
router.get("/store/:storeId/members", getMembers);
router.delete("/store/:storeId/members/:memberId", removeMemberFromStore);

export default router;