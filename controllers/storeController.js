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
import { uploadStoreLogoToStorage } from "../config/storage.js";
export const createFirstStoreController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, address, phone, whatsapp, email } = req.body;

    if (!name || !description || !address) {
      return errorResponse(
        res,
        "Name, description, and address are required",
        400
      );
    }

    const subscriptionStatus = await checkSubscriptionStatus(userId);
    if (!subscriptionStatus.hasAccess) {
      return errorResponse(
        res,
        "Active subscription required to create store.",
        403,
        { subscriptionRequired: true }
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

    const initialStore = await createFirstStore(storeData);
    if (!initialStore) {
      throw new Error("Failed to create store entry in database.");
    }

    if (req.file) {
      const logoBase64 = req.file.buffer.toString("base64");

      const imageUrl = await uploadStoreLogoToStorage(
        logoBase64,
        initialStore.id,
        initialStore.id,
        initialStore.name
      );
      const finalStore = await updateStore(initialStore.id, userId, {
        logo: imageUrl,
      });
      return successResponse(
        res,
        finalStore,
        "First store created successfully!",
        201
      );
    }
    return successResponse(
      res,
      initialStore,
      "First store created successfully!",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const createNewStore = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, address, phone, whatsapp, email } = req.body;

    if (!name || !description || !address) {
      return errorResponse(
        res,
        "Name, description, and address are required",
        400
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
    const initialStore = await createStore(storeData);
    if (!initialStore) {
      throw new Error("Failed to create store entry in database.");
    }
    if (req.file) {
      const logoBase64 = req.file.buffer.toString("base64");
      const imageUrl = await uploadStoreLogoToStorage(
        logoBase64,
        initialStore.id,
        initialStore.id,
        initialStore.name
      );
      const finalStore = await updateStore(initialStore.id, userId, {
        logo: imageUrl,
      });
      return successResponse(
        res,
        finalStore,
        "Store created successfully",
        201
      );
    }

    return successResponse(
      res,
      initialStore,
      "Store created successfully",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const updateStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    if (req.file) {
      const existingStore = await getStoreById(storeId, userId);
      if (!existingStore) {
        throw new Error("Store not found or you don't have access.");
      }

      const logoBase64 = req.file.buffer.toString("base64");
      const imageUrl = await uploadStoreLogoToStorage(
        logoBase64,
        existingStore.id,
        existingStore.id,
        existingStore.name
      );
      updateData.logo = imageUrl;
    }

    const store = await updateStore(storeId, userId, updateData);
    return successResponse(res, store, "Store updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const getMyStores = async (req, res) => {
  try {
    const userId = req.user.id;
    const stores = await getUserStores(userId);
    return successResponse(res, stores, "Stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
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
export const getAllStoresAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const result = await getAllStores(parseInt(page), parseInt(limit), search);
    return successResponse(res, result, "All stores retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
