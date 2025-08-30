import { successResponse, errorResponse } from "../utils/response.js";
import {
  createMemberInvitation,
  acceptMemberInvitation,
  getStoreInvitations,
  revokeInvitation,
  getStoreMembers,
  removeMember,
} from "../services/inviteService.js";

// Create member invitation
export const createInvite = async (req, res) => {
  try {
    const { storeId, invitedEmail, invitedName, role = "CASHIER" } = req.body;
    const invitedBy = req.user.id;

    if (!storeId || !invitedEmail || !invitedName) {
      return errorResponse(res, "Store ID, email, dan nama member diperlukan", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitedEmail)) {
      return errorResponse(res, "Format email tidak valid", 400);
    }

    if (invitedName.trim().length < 2) {
      return errorResponse(res, "Nama member minimal 2 karakter", 400);
    }

    const allowedRoles = ["CASHIER"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, "Role tidak valid", 400);
    }

    const invitation = await createMemberInvitation(
      storeId, 
      invitedEmail, 
      invitedName, 
      role, 
      invitedBy
    );

    return successResponse(
      res, 
      invitation, 
      "Undangan member berhasil dikirim ke email", 
      201
    );
  } catch (error) {
    console.error("Create invitation error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Accept member invitation
export const acceptInvite = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email dan password diperlukan", 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, "Format email tidak valid", 400);
    }

    const result = await acceptMemberInvitation(email, password, name);
    return successResponse(res, result, "Berhasil bergabung sebagai member toko");
  } catch (error) {
    console.error("Accept invitation error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Get store invitations
export const getInvites = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID diperlukan", 400);
    }

    const invitations = await getStoreInvitations(storeId, userId);
    return successResponse(res, invitations, "Daftar undangan berhasil diambil");
  } catch (error) {
    console.error("Get invitations error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Revoke invitation
export const revokeInviteCode = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    if (!inviteId) {
      return errorResponse(res, "Invite ID diperlukan", 400);
    }

    const result = await revokeInvitation(inviteId, userId);
    return successResponse(res, result, "Undangan berhasil dibatalkan");
  } catch (error) {
    console.error("Revoke invitation error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Get store members
export const getMembers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID diperlukan", 400);
    }

    const members = await getStoreMembers(storeId, userId);
    return successResponse(res, members, "Daftar member berhasil diambil");
  } catch (error) {
    console.error("Get members error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Remove member
export const removeMemberFromStore = async (req, res) => {
  try {
    const { memberId, storeId } = req.params;
    const userId = req.user.id;

    if (!memberId || !storeId) {
      return errorResponse(res, "Member ID dan Store ID diperlukan", 400);
    }

    const result = await removeMember(memberId, storeId, userId);
    return successResponse(res, result, "Member berhasil dihapus dari toko");
  } catch (error) {
    console.error("Remove member error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};