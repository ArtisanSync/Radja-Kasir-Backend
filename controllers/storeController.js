import { successResponse, errorResponse } from "../utils/response.js";
import {
  createStore,
  getUserStores,
  getStoreById,
  updateStore,
  deleteStore,
  getAllStores,
} from "../services/storeService.js";

// Create new store
export const createNewStore = async (req, res) => {
  try {
    const { name, storeType, address, whatsapp, logo, stamp } = req.body;
    const user = req.user;

    if (!name) {
      return errorResponse(res, "Store name is required", 400);
    }

    if (name.trim().length < 2) {
      return errorResponse(
        res,
        "Store name must be at least 2 characters",
        400
      );
    }

    const store = await createStore(
      { name, storeType, address, whatsapp, logo, stamp },
      user
    );
    return successResponse(res, store, "Store created successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get all stores for current user
export const getMyStores = async (req, res) => {
  try {
    const user = req.user;
    const stores = await getUserStores(user);
    return successResponse(res, stores, "Stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get single store by ID
export const getStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;
    const user = req.user;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const store = await getStoreById(storeId, user);
    return successResponse(res, store, "Store retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 404);
  }
};

// Update store
export const updateStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, storeType, address, whatsapp, logo, stamp } = req.body;
    const user = req.user;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    if (name && name.trim().length < 2) {
      return errorResponse(
        res,
        "Store name must be at least 2 characters",
        400
      );
    }

    const store = await updateStore(
      storeId,
      { name, storeType, address, whatsapp, logo, stamp },
      user
    );
    return successResponse(res, store, "Store updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete store
export const deleteStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    const user = req.user;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const result = await deleteStore(storeId, user);
    return successResponse(res, result, "Store deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get all stores (admin only)
export const getAllStoresAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    if (page < 1 || limit < 1) {
      return errorResponse(res, "Page and limit must be positive numbers", 400);
    }

    if (limit > 100) {
      return errorResponse(res, "Limit cannot exceed 100", 400);
    }

    const result = await getAllStores(page, limit, search);
    return successResponse(res, result, "Stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
