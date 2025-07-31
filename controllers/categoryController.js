import { successResponse, errorResponse } from "../utils/response.js";
import {
  createCategory,
  getUserCategories,
  getCategoriesByStore,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../services/categoryService.js";

// Create new category
export const createNewCategory = async (req, res) => {
  try {
    const { name, storeId } = req.body;
    const user = req.user;

    if (!name || !storeId) {
      return errorResponse(res, "Name and store ID are required", 400);
    }

    if (name.trim().length < 2) {
      return errorResponse(
        res,
        "Category name must be at least 2 characters",
        400
      );
    }

    const category = await createCategory({ name: name.trim(), storeId }, user);
    return successResponse(res, category, "Category created successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get all categories for authenticated user
export const getCategories = async (req, res) => {
  try {
    const user = req.user;
    const categories = await getUserCategories(user);
    return successResponse(
      res,
      categories,
      "Categories retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get categories by store ID
export const getCategoriesByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const user = req.user;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const categories = await getCategoriesByStore(storeId, user);
    return successResponse(
      res,
      categories,
      "Store categories retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get single category by ID
export const getCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const user = req.user;

    if (!categoryId) {
      return errorResponse(res, "Category ID is required", 400);
    }

    const category = await getCategoryById(categoryId, user);
    return successResponse(res, category, "Category retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 404);
  }
};

// Update category
export const updateCategoryData = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const updateData = req.body;
    const user = req.user;

    if (!categoryId) {
      return errorResponse(res, "Category ID is required", 400);
    }

    if (!updateData.name || updateData.name.trim().length < 2) {
      return errorResponse(
        res,
        "Valid category name is required (min 2 characters)",
        400
      );
    }

    const category = await updateCategory(
      categoryId,
      { name: updateData.name.trim() },
      user
    );
    return successResponse(res, category, "Category updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete category
export const removeCategoryData = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const user = req.user;

    if (!categoryId) {
      return errorResponse(res, "Category ID is required", 400);
    }

    const result = await deleteCategory(categoryId, user);
    return successResponse(res, result, "Category deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
