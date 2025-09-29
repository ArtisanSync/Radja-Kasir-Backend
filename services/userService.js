import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { generateToken, generateRandomToken } from "../utils/jwt.js";
import {
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "../libs/nodemailer.js";
import {
  uploadPhotoToStorage,
  deleteFileFromStorage,
} from "../config/storage.js";
import { BCRYPT_ROUNDS, TOKEN_CONFIG } from "../config/auth.js";
import { acceptMemberInvitation } from "./inviteService.js";

export const registerUser = async (userData) => {
  const { name, email, password } = userData;
  const lowerCaseEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: lowerCaseEmail },
  });

  if (existingUser && existingUser.emailVerifiedAt) {
    throw new Error(
      "Email is already registered and verified. Please use a different email or login."
    );
  }

  const pendingInvitation = await prisma.inviteCode.findFirst({
    where: {
      invitedEmail: lowerCaseEmail,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
  });
  if (pendingInvitation) {
    console.log(
      `Registration for invited email: ${lowerCaseEmail}. Accepting...`
    );
    const acceptedResult = await acceptMemberInvitation(
      lowerCaseEmail,
      password,
      name
    );

    const token = generateToken({
      userId: acceptedResult.member.userId,
      email: lowerCaseEmail,
    });
    const fullUserProfile = await getUserProfile(acceptedResult.member.userId);
    return { user: fullUserProfile, token: token };
  }
  if (existingUser && !existingUser.emailVerifiedAt) {
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = generateRandomToken();

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: lowerCaseEmail,
      password: hashedPassword,
      rememberToken: verificationToken,
    },
  });

  const emailSent = await sendVerificationEmail(email, verificationToken, name);
  if (!emailSent) {
    await prisma.user.delete({ where: { id: user.id } });
    throw new Error("Failed to send verification email. Please try again.");
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token: null,
    message:
      "Registration successful. Please check your email to verify your account.",
  };
};

export const verifyEmail = async (email, token) => {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      rememberToken: token,
      emailVerifiedAt: null,
    },
  });

  if (!user) {
    throw new Error(
      "Invalid email or verification token. Please check your credentials."
    );
  }

  // Check token expiry (24 hours)
  const tokenAge = Date.now() - user.updatedAt.getTime();
  if (tokenAge > TOKEN_CONFIG.verificationExpiry) {
    throw new Error(
      "Verification token has expired. Please request a new one."
    );
  }

  // Update as verified
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      rememberToken: null,
      isActive: true,
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
};
export const loginUser = async (email, password) => {
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      stores: {
        where: { isActive: true },
        select: { id: true, name: true, storeType: true, logo: true },
        take: 1,
      },
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
        include: { package: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      storeMembers: {
        where: { isActive: true },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              storeType: true,
              logo: true,
              userId: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
    },
  });

  let isFirstLoginFromInvite = false;

  if (!user) {
    const invitation = await prisma.inviteCode.findFirst({
      where: {
        invitedEmail: email.toLowerCase().trim(),
        status: "PENDING",
        expiresAt: { gte: new Date() },
      },
    });
    if (!invitation) {
      throw new Error(
        "Invalid email or password. Please check your credentials."
      );
    }
    const isPasswordValid = await bcrypt.compare(
      password,
      invitation.tempPassword
    );
    if (!isPasswordValid) {
      throw new Error(
        "Invalid email or password. Please check your credentials."
      );
    }
    const acceptedResult = await acceptMemberInvitation(
      email,
      password,
      invitation.invitedName
    );
    user = await prisma.user.findUnique({
      where: { id: acceptedResult.member.userId },
    });
    isFirstLoginFromInvite = true;
  } else {
    if (!user.emailVerifiedAt && user.role !== "MEMBER") {
      throw new Error("Please verify your email address before logging in");
    }
    if (!user.isActive) {
      throw new Error("Account is deactivated. Please contact support.");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error(
        "Invalid email or password. Please check your credentials."
      );
    }
  }
  if (!user) {
    throw new Error("An unexpected error occurred during login.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateToken({ userId: user.id, email: user.email });
  const fullUserProfile = await getUserProfile(user.id);

  const userResponse = {
    ...fullUserProfile,
    mustChangePassword: isFirstLoginFromInvite,
  };

  return { user: userResponse, token };
};

export const updateUser = async (userId, updateData, file) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatar: true,
    },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  let avatarUrl = existingUser.avatar;

  if (file) {
    try {
      const newAvatarUrl = await uploadPhotoToStorage(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        userId,
        userId,
        userId,
        "avatar"
      );

      if (newAvatarUrl && existingUser.avatar) {
        try {
          await deleteFileFromStorage(existingUser.avatar);
        } catch (deleteError) {}
      }
      avatarUrl = newAvatarUrl;
    } catch (error) {
      throw new Error("Failed to upload avatar");
    }
  }

  const updatePayload = {};
  if (updateData.name) updatePayload.name = updateData.name.trim();
  if (updateData.phone) updatePayload.phone = updateData.phone.trim();
  if (updateData.businessName !== undefined)
    updatePayload.businessName = updateData.businessName?.trim() || null;
  if (updateData.businessType !== undefined)
    updatePayload.businessType = updateData.businessType?.trim() || null;
  if (updateData.businessAddress !== undefined)
    updatePayload.businessAddress = updateData.businessAddress?.trim() || null;
  if (updateData.whatsapp !== undefined)
    updatePayload.whatsapp = updateData.whatsapp?.trim() || null;

  if (avatarUrl !== existingUser.avatar) updatePayload.avatar = avatarUrl;
  if (updateData.password) {
    updatePayload.password = await bcrypt.hash(
      updateData.password,
      BCRYPT_ROUNDS
    );
  }
  await prisma.user.update({
    where: { id: userId },
    data: updatePayload,
  });
  const fullUserProfile = await getUserProfile(userId);
  return fullUserProfile;
};

export const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      phone: true,
      businessName: true,
      businessType: true,
      businessAddress: true,
      whatsapp: true,
      isActive: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      stores: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          storeType: true,
          address: true,
          logo: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      storeMembers: {
        where: { isActive: true },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          store: {
            select: {
              id: true,
              name: true,
              storeType: true,
              logo: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          isTrial: true,
          trialEndDate: true,
          isNewUserPromo: true,
          paidMonths: true,
          bonusMonths: true,
          totalMonths: true,
          package: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error("User profile not found");
  }

  const hasStore = user.stores.length > 0;
  const hasActiveSubscription = user.subscriptions.length > 0;
  const response = {
    ...user,
    hasStore,
    isSubscribed: hasActiveSubscription,
    currentSubscription: hasActiveSubscription ? user.subscriptions[0] : null,
  };

  return response;
};

export const resendVerificationToken = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim(), emailVerifiedAt: null },
  });

  if (!user) {
    throw new Error("User not found or email is already verified");
  }

  const verificationToken = generateRandomToken();

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
    throw new Error("Failed to send verification email. Please try again.");
  }

  return true;
};

export const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) {
    throw new Error("No account found with this email address");
  }

  const resetToken = generateRandomToken();

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
    throw new Error("Failed to send password reset email. Please try again.");
  }

  return true;
};

export const resendResetToken = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) {
    throw new Error("No account found with this email address");
  }

  const resetToken = generateRandomToken();

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
    throw new Error("Failed to send password reset email. Please try again.");
  }

  return true;
};

export const resetPassword = async (email, token, newPassword) => {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      rememberToken: token,
    },
  });

  if (!user) {
    throw new Error(
      "Invalid email or reset token. Please check your credentials."
    );
  }

  // Check token expiry (15 minutes)
  const tokenAge = Date.now() - user.updatedAt.getTime();
  if (tokenAge > TOKEN_CONFIG.resetExpiry) {
    throw new Error(
      "Reset token has expired. Please request a new password reset."
    );
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
};

export const deleteUser = async (userId, currentUser) => {
  if (currentUser.role !== "ADMIN") {
    throw new Error("Only administrators can delete users");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      avatar: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot delete your own account");
  }

  if (targetUser.avatar) {
    try {
      await deleteFileFromStorage(targetUser.avatar);
    } catch (error) {}
  }

  await prisma.user.delete({ where: { id: userId } });
  return { deletedUser: targetUser.name };
};

export const getAllUsers = async (currentUser) => {
  if (currentUser.role !== "ADMIN") {
    throw new Error("Only administrators can view all users");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      businessName: true,
      businessType: true,
      isActive: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
};
