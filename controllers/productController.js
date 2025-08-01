import { successResponse, errorResponse } from "../utils/response.js";
import {
  createProduct,
  getProductsByStore,
  getProductById,
  updateProduct,
  toggleFavoriteProduct,
  deleteProduct,
  getAllUnits,
} from "../services/productService.js";

// Create product
export const createNewProduct = async (req, res) => {
  try {
    const { name, unitId, capitalPrice, price, quantity, storeId } = req.body;

    if (!name || !unitId || !capitalPrice || !price || !quantity || !storeId) {
      return errorResponse(
        res,
        "Name, unit, capital price, selling price, quantity and store are required",
        400
      );
    }

    if (parseFloat(capitalPrice) < 0 || parseFloat(price) < 0) {
      return errorResponse(res, "Prices must be positive numbers", 400);
    }

    if (parseInt(quantity) < 0) {
      return errorResponse(res, "Quantity must be positive number", 400);
    }

    const userId = req.user.id;
    const file = req.file;

    const product = await createProduct(req.body, file, userId);
    return successResponse(res, product, "Product created successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get products by store
export const getProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const filters = req.query;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const result = await getProductsByStore(storeId, userId, filters);
    return successResponse(res, result, "Products retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get product by ID
export const getProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    if (!productId) {
      return errorResponse(res, "Product ID is required", 400);
    }

    const product = await getProductById(productId, userId);
    return successResponse(res, product, "Product retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 404);
  }
};

// Update product
export const updateExistingProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    const file = req.file;

    if (!productId) {
      return errorResponse(res, "Product ID is required", 400);
    }

    const product = await updateProduct(productId, updateData, file, userId);
    return successResponse(res, product, "Product updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Toggle favorite
export const toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    if (!productId) {
      return errorResponse(res, "Product ID is required", 400);
    }

    const product = await toggleFavoriteProduct(productId, userId);
    return successResponse(res, product, "Product favorite status updated");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete product
export const removeProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    if (!productId) {
      return errorResponse(res, "Product ID is required", 400);
    }

    const result = await deleteProduct(productId, userId);
    return successResponse(res, result, "Product deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get units
export const getUnits = async (req, res) => {
  try {
    const units = await getAllUnits();
    return successResponse(res, units, "Units retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Bulk operations
export const bulkUpdateProducts = async (req, res) => {
  try {
    const { productIds, updateData } = req.body;
    const userId = req.user.id;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return errorResponse(res, "Product IDs array is required", 400);
    }

    if (!updateData || typeof updateData !== 'object') {
      return errorResponse(res, "Update data is required", 400);
    }

    const results = [];
    for (const productId of productIds) {
      try {
        const product = await updateProduct(productId, updateData, null, userId);
        results.push({ productId, success: true, product });
      } catch (error) {
        results.push({ productId, success: false, error: error.message });
      }
    }

    return successResponse(res, results, "Bulk update completed");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get products with low stock
export const getLowStockProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { threshold = 10 } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const filters = {
      lowStock: true,
      stockThreshold: parseInt(threshold)
    };

    const result = await getProductsByStore(storeId, userId, filters);
    return successResponse(res, result, "Low stock products retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
