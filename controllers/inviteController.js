import { successResponse, errorResponse } from "../utils/response.js";
import {
  generateInviteCode,
  acceptInviteCode,
  getStoreInvites,
  revokeInvite,
} from "../services/inviteService.js";

// Generate invite code
export const createInvite = async (req, res) => {
  try {
    const { storeId, invitedEmail, role = "CASHIER" } = req.body;
    const invitedBy = req.user.id;

    if (!storeId || !invitedEmail) {
      return errorResponse(res, "Store ID and invited email are required", 400);
    }

    const invite = await generateInviteCode(storeId, invitedEmail, role, invitedBy);
    return successResponse(res, invite, "Invitation sent successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Accept invite code
export const acceptInvite = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return errorResponse(res, "Invite code is required", 400);
    }

    const result = await acceptInviteCode(code, userId);
    return successResponse(res, result, "Invitation accepted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get store invites
export const getInvites = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    const invites = await getStoreInvites(storeId, userId);
    return successResponse(res, invites, "Invites retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Revoke invite
export const revokeInviteCode = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    const result = await revokeInvite(inviteId, userId);
    return successResponse(res, result, "Invitation revoked successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
