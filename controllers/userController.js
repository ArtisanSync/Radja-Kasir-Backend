import { successResponse, errorResponse } from "../utils/response.js";
import {
  registerUser,
  loginUser,
  updateUser,
  requestPasswordReset,
  resetPassword,
  deleteUser,
  getAllUsers,
} from "../services/userService.js";

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, "Name, email, and password are required", 400);
    }

    if (password.length < 6) {
      return errorResponse(res, "Password must be at least 6 characters", 400);
    }

    const result = await registerUser({ name, email, password });
    return successResponse(res, result, "User registered successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    const result = await loginUser(email, password);
    return successResponse(res, result, "Login successful");
  } catch (error) {
    return errorResponse(res, error.message, 401);
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    const file = req.file;

    const user = await updateUser(userId, updateData, file);
    return successResponse(res, user, "Profile updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    await requestPasswordReset(email);
    return successResponse(res, null, "Reset token sent to your email");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Reset password - Enhanced debugging
export const resetUserPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return errorResponse(res, "Token and new password are required", 400);
    }

    if (password.length < 6) {
      return errorResponse(res, "Password must be at least 6 characters", 400);
    }

    console.log(
      "Reset password request received with token:",
      token.substring(0, 20) + "..."
    ); // Debug log

    await resetPassword(token, password);
    return successResponse(res, null, "Password reset successfully");
  } catch (error) {
    console.error("Reset password controller error:", error); // Debug log
    return errorResponse(res, error.message, 400);
  }
};

// Delete user
export const removeUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (!userId) {
      return errorResponse(res, "User ID is required", 400);
    }

    const result = await deleteUser(userId, currentUser);
    return successResponse(res, result, "User deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 403);
  }
};

// Get all users
export const getUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    const users = await getAllUsers(currentUser);
    return successResponse(res, users, "Users retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 403);
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    return successResponse(res, req.user, "Profile retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
