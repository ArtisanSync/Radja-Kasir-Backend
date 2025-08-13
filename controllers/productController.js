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
    const hasUpdateData = Object.keys(updateData).length > 0 || file;
    
    if (!hasUpdateData) {
      return errorResponse(res, "No data provided for update", 400);
    }

    const product = await updateProduct(productId, updateData, file, userId);
    return successResponse(res, product, "Product updated successfully");
  } catch (error) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    return errorResponse(res, error.message, statusCode);
  }
};

// Toggle favorite
export const toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const product = await toggleFavoriteProduct(productId, userId);
    return successResponse(res, product, "Product favorite status updated");
  } catch (error) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    return errorResponse(res, error.message, statusCode);
  }
};

// Delete product
export const removeProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const result = await deleteProduct(productId, userId);
    return successResponse(res, result, "Product deleted successfully");
  } catch (error) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    return errorResponse(res, error.message, statusCode);
  }
};

// Get units
export const getUnits = async (_req, res) => {
  try {
    const units = await getAllUnits();
    return successResponse(res, units, "Units retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};