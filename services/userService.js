import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import {
  generateToken,
  generateResetToken,
  generateVerificationToken,
  verifyToken,
} from "../utils/jwt.js";
import {
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "../libs/nodemailer.js";
import imagekit from "../config/imagekit.js";
import { BCRYPT_ROUNDS } from "../config/auth.js";

// Register new user
export const registerUser = async (userData) => {
  const { name, email, password } = userData;

  // Check existing user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = generateVerificationToken({ email });

  // Create user with verification token
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      rememberToken: verificationToken,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Send verification email
  const emailSent = await sendVerificationEmail(email, verificationToken, name);
  if (!emailSent) {
    await prisma.user.delete({ where: { id: user.id } });
    throw new Error("Failed to send verification email");
  }

  return {
    user,
    message:
      "Registration successful. Please check your email to verify your account.",
  };
};

// Resend verification token
export const resendVerificationToken = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email, emailVerifiedAt: null },
  });

  if (!user) {
    throw new Error("User not found or already verified");
  }

  const verificationToken = generateVerificationToken({ email });

  // Update user with new token
  await prisma.user.update({
    where: { id: user.id },
    data: { rememberToken: verificationToken },
  });

  const emailSent = await sendVerificationEmail(
    email,
    verificationToken,
    user.name
  );
  if (!emailSent) {
    throw new Error("Failed to send verification email");
  }

  return true;
};

// Verify email
export const verifyEmail = async (token) => {
  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findFirst({
      where: {
        email: decoded.email,
        rememberToken: token,
        emailVerifiedAt: null,
      },
    });

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    // Update user as verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        rememberToken: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
      },
    });

    // Generate login token
    const loginToken = generateToken({ userId: user.id, email: user.email });

    return { user: updatedUser, token: loginToken };
  } catch (error) {
    throw new Error("Invalid or expired verification token");
  }
};

// Login user
export const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  // Check if email is verified
  if (!user.emailVerifiedAt) {
    throw new Error("Please verify your email before logging in");
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

  // Upload avatar if provided
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

// Resend reset password token
export const resendResetToken = async (email) => {
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

// Reset password with token
export const resetPassword = async (token, newPassword) => {
  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        rememberToken: token,
      },
    });

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        rememberToken: null,
      },
    });

    return true;
  } catch (error) {
    throw new Error("Invalid or expired reset token");
  }
};

// Delete user - Only ADMIN can delete any user
export const deleteUser = async (userId, currentUser) => {
  if (currentUser.role !== "ADMIN") {
    throw new Error("Only administrators can delete users");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  // Prevent self-deletion
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
      emailVerifiedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
};

// Get user profile with all relations
export const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isMember: true,
      isSubscribe: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      // Include all related data
      stores: {
        select: {
          id: true,
          name: true,
          storeType: true,
          address: true,
          logo: true,
          createdAt: true,
        },
      },
      storeMembers: {
        select: {
          id: true,
          store: {
            select: {
              id: true,
              name: true,
              storeType: true,
              logo: true,
            },
          },
          createdAt: true,
        },
      },
      subscribes: {
        select: {
          id: true,
          packageId: true,
          endDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};
