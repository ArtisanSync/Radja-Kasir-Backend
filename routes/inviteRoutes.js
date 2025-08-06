import express from "express";
import {
  createInvite,
  acceptInvite,
  getInvites,
  revokeInviteCode,
} from "../controllers/inviteController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createInvite);
router.post("/accept", acceptInvite);
router.get("/store/:storeId", getInvites);
router.delete("/:inviteId", revokeInviteCode);

export default router;
