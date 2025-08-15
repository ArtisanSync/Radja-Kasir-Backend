import { successResponse, errorResponse } from "../utils/response.js";
import {
  createFirstStore,
  createStore,
  getUserStores,
  getStoreById,
  updateStore,
  deleteStore,
  getAllStores,
} from "../services/storeService.js";
import { checkSubscriptionStatus } from "../services/subscriptionService.js";

// Create first store - HARUS PUNYA SUBSCRIPTION
export const createFirstStoreController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, address, phone, whatsapp, email } = req.body;

    if (!name || !description || !address) {
      return errorResponse(res, "Name, description, and address are required", 400);
    }

    // ✅ CHECK SUBSCRIPTION STATUS FIRST
    const subscriptionStatus = await checkSubscriptionStatus(userId);
    if (!subscriptionStatus.hasAccess) {
      return errorResponse(
        res,
        "Active subscription required to create store. Please subscribe first to access this feature.",
        403,
        {
          subscriptionRequired: true,
          message: "You must have an active subscription to create your first store",
          redirectTo: "/subscription/packages"
        }
      );
    }

    const storeData = {
      userId,
      name,
      description,
      address,
      phone,
      whatsapp,
      email,
    };

    const store = await createFirstStore(storeData);
    return successResponse(
      res,
      store,
      "First store created successfully! You can now start managing your inventory.",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Create additional store
export const createNewStore = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, address, phone, whatsapp, email } = req.body;

    if (!name || !description || !address) {
      return errorResponse(res, "Name, description, and address are required", 400);
    }

    const storeData = {
      userId,
      name,
      description,
      address,
      phone,
      whatsapp,
      email,
    };

    const store = await createStore(storeData);
    return successResponse(res, store, "Store created successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get user's stores
export const getMyStores = async (req, res) => {
  try {
    const userId = req.user.id;
    const stores = await getUserStores(userId);
    return successResponse(res, stores, "Stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get store details
export const getStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const store = await getStoreById(storeId, userId);
    return successResponse(res, store, "Store details retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Update store
export const updateStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const store = await updateStore(storeId, userId, updateData);
    return successResponse(res, store, "Store updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete store
export const deleteStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const result = await deleteStore(storeId, userId);
    return successResponse(res, result, "Store deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Admin: Get all stores
export const getAllStoresAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const result = await getAllStores(parseInt(page), parseInt(limit), search);
    return successResponse(res, result, "All stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};