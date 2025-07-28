import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import {
  generateToken,
  generateResetToken,
  verifyToken,
} from "../utils/jwt.js"; // Fix: Add verifyToken import
import { sendResetPasswordEmail } from "../libs/nodemailer.js";
import imagekit from "../config/imagekit.js";
import { BCRYPT_ROUNDS } from "../config/auth.js";

// Register new user
export const registerUser = async (userData) => {
  const { name, email, password } = userData;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = generateToken({ userId: user.id, email: user.email });
  return { user, token };
};

// Login user
export const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken({ userId: user.id, email: user.email });
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};

// Update user profile
export const updateUser = async (userId, updateData, file) => {
  let avatarUrl = null;

  if (file) {
    const uploadResponse = await imagekit.upload({
      file: file.buffer,
      fileName: `avatar_${userId}_${Date.now()}`,
      folder: "/users/avatars",
      useUniqueFileName: true,
      transformation: { pre: "w-300,h-300,c-maintain_ratio" },
    });
    avatarUrl = uploadResponse.url;
  }

  const updatePayload = { ...updateData };
  if (avatarUrl) updatePayload.avatar = avatarUrl;
  if (updateData.password) {
    updatePayload.password = await bcrypt.hash(
      updateData.password,
      BCRYPT_ROUNDS
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updatePayload,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      updatedAt: true,
    },
  });

  return user;
};

// Request password reset
export const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("User with this email not found");
  }

  const resetToken = generateResetToken({ userId: user.id, email: user.email });

  await prisma.user.update({
    where: { id: user.id },
    data: { rememberToken: resetToken },
  });

  const emailSent = await sendResetPasswordEmail(
    user.email,
    resetToken,
    user.name
  );
  if (!emailSent) {
    throw new Error("Failed to send reset email");
  }

  return true;
};

// Reset password with token - FIXED
export const resetPassword = async (token, newPassword) => {
  try {
    // Verify token first
    const decoded = verifyToken(token);

    // Find user with matching token
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        rememberToken: token,
      },
    });

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        rememberToken: null,
      },
    });

    return true;
  } catch (error) {
    console.error("Reset password error:", error); // Debug log
    throw new Error("Invalid or expired reset token");
  }
};

// Delete user with permission check
export const deleteUser = async (userId, currentUser) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  // Permission checks
  if (currentUser.role === "MEMBER") {
    throw new Error("Members cannot delete users");
  }

  if (currentUser.role === "USER" && targetUser.role !== "MEMBER") {
    throw new Error("Users can only delete members");
  }

  if (currentUser.id === userId) {
    throw new Error("Cannot delete yourself");
  }

  await prisma.user.delete({ where: { id: userId } });
  return { deletedUser: targetUser.name };
};

// Get all users (admin only)
export const getAllUsers = async (currentUser) => {
  if (currentUser.role !== "ADMIN") {
    throw new Error("Only admins can view all users");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
};
