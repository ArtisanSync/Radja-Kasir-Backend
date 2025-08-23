import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { generateRandomToken } from "../utils/jwt.js";
import { sendInvitationEmail } from "../libs/nodemailer.js";
import { canAddMember } from "./subscriptionService.js";
import { BCRYPT_ROUNDS } from "../config/auth.js";

// Generate member invitation with email and password
export const createMemberInvitation = async (storeId, invitedEmail, invitedName, role, invitedBy) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { user: true },
  });

  if (!store) {
    throw new Error("Store tidak ditemukan");
  }

  const memberLimit = await canAddMember(storeId, store.userId);
  if (!memberLimit.canAdd) {
    throw new Error(memberLimit.reason);
  }

  const existingMember = await prisma.storeMember.findFirst({
    where: {
      storeId,
      user: {
        email: invitedEmail.toLowerCase().trim(),
      },
      isActive: true,
    },
  });

  if (existingMember) {
    throw new Error("Email sudah terdaftar sebagai member di toko ini");
  }

  const existingInvite = await prisma.inviteCode.findFirst({
    where: {
      storeId,
      invitedEmail: invitedEmail.toLowerCase().trim(),
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
  });

  if (existingInvite) {
    throw new Error("Undangan sudah dikirim ke email ini dan masih aktif");
  }

  const tempPassword = generateRandomToken();
  const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create invitation record
  const invitation = await prisma.inviteCode.create({
    data: {
      storeId,
      invitedBy,
      invitedEmail: invitedEmail.toLowerCase().trim(),
      invitedName: invitedName.trim(),
      tempPassword: hashedPassword,
      role,
      expiresAt,
      status: "PENDING",
    },
    include: {
      store: {
        select: {
          name: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Send invitation email with credentials
  const emailSent = await sendInvitationEmail(
    invitedEmail,
    invitedName,
    tempPassword,
    store.name,
    store.user.name,
    role
  );

  if (!emailSent) {
    await prisma.inviteCode.delete({
      where: { id: invitation.id },
    });
    throw new Error("Gagal mengirim email undangan. Silakan coba lagi.");
  }

  return {
    ...invitation,
    tempPassword: undefined,
    credentials: {
      email: invitedEmail,
      message: "Email dan password telah dikirim ke alamat email yang diundang",
    },
  };
};

// Accept invitation and create member account
export const acceptMemberInvitation = async (email, password, invitedName) => {
  const invitation = await prisma.inviteCode.findFirst({
    where: {
      invitedEmail: email.toLowerCase().trim(),
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          logo: true,
          userId: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new Error("Undangan tidak valid atau sudah kedaluwarsa");
  }

  const isPasswordValid = await bcrypt.compare(password, invitation.tempPassword);
  if (!isPasswordValid) {
    throw new Error("Password yang dimasukkan salah");
  }

  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (!user) {
      user = await tx.user.create({
        data: {
          name: invitedName || invitation.invitedName,
          email: email.toLowerCase().trim(),
          password: invitation.tempPassword,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      });
    } else if (user.role === "USER") {
      await tx.user.update({
        where: { id: user.id },
        data: { role: "MEMBER" },
      });
    }

    const existingMembership = await tx.storeMember.findFirst({
      where: {
        storeId: invitation.storeId,
        userId: user.id,
        isActive: true,
      },
    });

    if (existingMembership) {
      throw new Error("Anda sudah menjadi member di toko ini");
    }

    const storeMember = await tx.storeMember.create({
      data: {
        storeId: invitation.storeId,
        userId: user.id,
        email: email.toLowerCase().trim(),
        password: invitation.tempPassword,
        role: invitation.role,
        isActive: true,
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

    // Mark invitation as accepted
    await tx.inviteCode.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedBy: user.id,
      },
    });

    return storeMember;
  });

  return {
    member: result,
    message: "Berhasil bergabung sebagai member toko",
    store: result.store,
    credentials: {
      email: email,
      message: "Sekarang Anda dapat login menggunakan email dan password yang dikirim",
    },
  };
};

// Get store invitations
export const getStoreInvitations = async (storeId, userId) => {
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId: userId,
    },
  });

  if (!store) {
    throw new Error("Store tidak ditemukan atau Anda bukan pemilik toko");
  }

  const invitations = await prisma.inviteCode.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invitedEmail: true,
      invitedName: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  });

  return invitations;
};

// Revoke invitation
export const revokeInvitation = async (inviteId, userId) => {
  const invitation = await prisma.inviteCode.findUnique({
    where: { id: inviteId },
    include: {
      store: true,
    },
  });

  if (!invitation) {
    throw new Error("Undangan tidak ditemukan");
  }

  if (invitation.store.userId !== userId) {
    throw new Error("Hanya pemilik toko yang dapat membatalkan undangan");
  }

  if (invitation.status !== "PENDING") {
    throw new Error("Hanya undangan yang pending yang dapat dibatalkan");
  }

  await prisma.inviteCode.update({
    where: { id: inviteId },
    data: {
      status: "REVOKED",
      updatedAt: new Date(),
    },
  });

  return { message: "Undangan berhasil dibatalkan" };
};

// Get store members
export const getStoreMembers = async (storeId, userId) => {
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [
        { userId: userId },
        { members: { some: { userId: userId, isActive: true } } },
      ],
    },
  });

  if (!store) {
    throw new Error("Store tidak ditemukan atau akses ditolak");
  }

  const members = await prisma.storeMember.findMany({
    where: {
      storeId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return members;
};

// Remove member
export const removeMember = async (memberId, storeId, userId) => {
  const member = await prisma.storeMember.findUnique({
    where: { id: memberId },
    include: {
      store: true,
    },
  });

  if (!member) {
    throw new Error("Member tidak ditemukan");
  }

  if (member.store.userId !== userId) {
    throw new Error("Hanya pemilik toko yang dapat menghapus member");
  }

  if (member.storeId !== storeId) {
    throw new Error("Member tidak berada di toko ini");
  }

  await prisma.storeMember.update({
    where: { id: memberId },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  return { message: "Member berhasil dihapus dari toko" };
};