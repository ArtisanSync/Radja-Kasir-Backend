import { successResponse, errorResponse } from "../utils/response.js";
import {
  getActiveSubscribers,
  updateUserSubscription,
  extendSubscription,
  deleteUserAccount,
  deleteStoreMember,
  getAdminDashboardStats,
} from "../services/adminService.js";

// Get all active subscribers
export const getAllActiveSubscribers = async (req, res) => {
  try {
    const { search, packageType, expiringOnly } = req.query;
    
    let subscribers = await getActiveSubscribers();
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      subscribers = subscribers.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.businessName?.toLowerCase().includes(searchLower)
      );
    }
    
    if (packageType) {
      subscribers = subscribers.filter(user => 
        user.currentSubscription?.package.name === packageType
      );
    }
    
    if (expiringOnly === 'true') {
      subscribers = subscribers.filter(user => user.isExpiringSoon);
    }

    return successResponse(
      res, 
      subscribers, 
      `Ditemukan ${subscribers.length} subscriber aktif`
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Update user subscription package
export const changeUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { packageId } = req.body;
    const adminId = req.user.id;

    if (!userId || !packageId) {
      return errorResponse(res, "User ID dan Package ID diperlukan", 400);
    }

    const result = await updateUserSubscription(userId, packageId, adminId);
    return successResponse(res, result, "Subscription berhasil diubah");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Extend subscription duration
export const extendUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { additionalDays } = req.body;
    const adminId = req.user.id;

    if (!userId || !additionalDays) {
      return errorResponse(res, "User ID dan additional days diperlukan", 400);
    }

    if (additionalDays < 1 || additionalDays > 365) {
      return errorResponse(res, "Additional days harus antara 1-365 hari", 400);
    }

    const result = await extendSubscription(userId, parseInt(additionalDays), adminId);
    return successResponse(res, result, "Subscription berhasil diperpanjang");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete user account
export const removeUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    if (!userId) {
      return errorResponse(res, "User ID diperlukan", 400);
    }

    const result = await deleteUserAccount(userId, adminId);
    return successResponse(res, result, "Akun user berhasil dihapus");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete store member
export const removeStoreMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const adminId = req.user.id;

    if (!memberId) {
      return errorResponse(res, "Member ID diperlukan", 400);
    }

    const result = await deleteStoreMember(memberId, adminId);
    return successResponse(res, result, "Member berhasil dihapus");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get admin dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const stats = await getAdminDashboardStats();
    return successResponse(res, stats, "Dashboard statistics retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};