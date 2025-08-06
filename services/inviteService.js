import prisma from "../config/prisma.js";
import { generateRandomToken } from "../utils/jwt.js";
import { sendInvitationEmail } from "../libs/nodemailer.js";
import { canAddMember } from "./subscriptionService.js";

export const generateInviteCode = async (storeId, invitedEmail, role, invitedBy) => {

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { user: true },
  });

  if (!store) {
    throw new Error("Store not found");
  }

  const memberLimit = await canAddMember(storeId, store.userId);
  if (!memberLimit.canAdd) {
    throw new Error(memberLimit.reason);
  }

  const existingMember = await prisma.storeMember.findFirst({
    where: {
      storeId,
      user: { email: invitedEmail },
      isActive: true,
    },
  });

  if (existingMember) {
    throw new Error("User is already a member of this store");
  }

  const existingInvite = await prisma.inviteCode.findFirst({
    where: {
      storeId,
      invitedEmail,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
  });

  if (existingInvite) {
    throw new Error("Invitation already sent to this email");
  }

  const code = generateRandomToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const inviteCode = await prisma.inviteCode.create({
    data: {
      storeId,
      invitedBy,
      invitedEmail,
      code,
      role,
      expiresAt,
    },
  });

  const inviterUser = await prisma.user.findUnique({
    where: { id: invitedBy },
    select: { name: true },
  });

  await sendInvitationEmail(
    invitedEmail,
    code,
    store.name,
    inviterUser?.name || "Someone"
  );

  return inviteCode;
};

// Accept invite code
export const acceptInviteCode = async (code, userId) => {
  const inviteCode = await prisma.inviteCode.findFirst({
    where: {
      code,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    include: {
      store: true,
    },
  });

  if (!inviteCode) {
    throw new Error("Invalid or expired invitation code");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.email !== inviteCode.invitedEmail) {
    throw new Error("This invitation is not for your email address");
  }

  const existingMember = await prisma.storeMember.findFirst({
    where: {
      storeId: inviteCode.storeId,
      userId,
      isActive: true,
    },
  });

  if (existingMember) {
    throw new Error("You are already a member of this store");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update invite code status
    await tx.inviteCode.update({
      where: { id: inviteCode.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedBy: userId,
      },
    });

    // Add user as store member
    const storeMember = await tx.storeMember.create({
      data: {
        storeId: inviteCode.storeId,
        userId,
        role: inviteCode.role,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return storeMember;
  });

  return result;
};

// Get store invites
export const getStoreInvites = async (storeId, userId) => {
  // Verify user has access to store
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [
        { userId },
        { members: { some: { userId, isActive: true } } }
      ],
    },
  });

  if (!store) {
    throw new Error("Store not found or access denied");
  }

  const invites = await prisma.inviteCode.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });

  return invites;
};

// Revoke invite
export const revokeInvite = async (inviteId, userId) => {
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id: inviteId },
    include: {
      store: true,
    },
  });

  if (!inviteCode) {
    throw new Error("Invite not found");
  }

  if (inviteCode.invitedBy !== userId && inviteCode.store.userId !== userId) {
    throw new Error("Permission denied");
  }

  if (inviteCode.status !== "PENDING") {
    throw new Error("Cannot revoke non-pending invitation");
  }

  await prisma.inviteCode.update({
    where: { id: inviteId },
    data: {
      status: "EXPIRED",
    },
  });

  return { message: "Invitation revoked successfully" };
};
