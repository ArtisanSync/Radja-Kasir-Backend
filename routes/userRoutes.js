import express from "express";
import {
  register,
  login,
  updateProfile,
  forgotPassword,
  resetUserPassword,
  removeUser,
  getUsers,
  getProfile,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  authorizeAdmin,
  authorizeAdminOrUser,
} from "../middlewares/roleMiddleware.js";
import { uploadSingle } from "../middlewares/multer.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
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

// Admin and User can delete (with restrictions)
router.delete("/:userId", authenticateToken, authorizeAdminOrUser, removeUser);

export default router;
