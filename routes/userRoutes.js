import express from "express";
import {
  register,
  resendVerification,
  verifyUserEmail,
  login,
  updateProfile,
  forgotPassword,
  resendResetPassword,
  resetUserPassword,
  removeUser,
  getUsers,
  getProfile,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeAdmin } from "../middlewares/roleMiddleware.js";
import { uploadSingle } from "../middlewares/multer.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/resend-verification", resendVerification);
router.post("/verify-email", verifyUserEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/resend-reset", resendResetPassword);
router.post("/reset-password", resetUserPassword);

// Protected routes
router.get("/profile", authenticateToken, getProfile);
router.put(
  "/profile",
  authenticateToken,
  uploadSingle("avatar"),
  updateProfile
);

// Admin only routes
router.get("/", authenticateToken, authorizeAdmin, getUsers);
router.delete("/:userId", authenticateToken, authorizeAdmin, removeUser);

export default router;
