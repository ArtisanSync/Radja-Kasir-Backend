import { successResponse, errorResponse } from "../utils/response.js";
import { validatePassword } from "../utils/validation.js";
import {
  registerUser,
  resendVerificationToken,
  verifyEmail,
  loginUser,
  updateUser,
  requestPasswordReset,
  resendResetToken,
  resetPassword,
  deleteUser,
  getAllUsers,
  getUserProfile,
} from "../services/userService.js";

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields
    if (!name || !email || !password) {
      return errorResponse(res, "Name, email, and password are required", 400);
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(res, passwordError, 400);
    }

    const result = await registerUser({ name, email, password });
    return successResponse(
      res,
      result,
      "Registration successful. Please check your email to verify your account.",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Resend verification token
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email address is required", 400);
    }

    await resendVerificationToken(email);
    return successResponse(
      res,
      null,
      "Verification token has been sent to your email"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Verify email
export const verifyUserEmail = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return errorResponse(
        res,
        "Email and verification token are required",
        400
      );
    }

    const result = await verifyEmail(email, token);
    return successResponse(
      res,
      result,
      "Email verified successfully. You can now login."
    );
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
    return successResponse(res, result, "Login successful. Welcome back!");
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

    // Validate password if provided
    if (updateData.password) {
      const passwordError = validatePassword(updateData.password);
      if (passwordError) {
        return errorResponse(res, passwordError, 400);
      }
    }

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
      return errorResponse(res, "Email address is required", 400);
    }

    await requestPasswordReset(email);
    return successResponse(
      res,
      null,
      "Password reset token has been sent to your email"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Resend reset password token
export const resendResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email address is required", 400);
    }

    await resendResetToken(email);
    return successResponse(
      res,
      null,
      "Password reset token has been resent to your email"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Reset password
export const resetUserPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      return errorResponse(
        res,
        "Email, token and new password are required",
        400
      );
    }

    // Validate new password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(res, passwordError, 400);
    }

    await resetPassword(email, token, password);
    return successResponse(
      res,
      null,
      "Password reset successful. You can now login with your new password."
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Delete user (Admin only)
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

// Get all users (Admin only)
export const getUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    const users = await getAllUsers(currentUser);
    return successResponse(res, users, "Users retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 403);
  }
};

// Get profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getUserProfile(userId);
    return successResponse(res, profile, "Profile retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
