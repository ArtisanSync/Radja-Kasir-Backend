import prisma from "../config/prisma.js";

// Mendapatkan semua paket subscription
export const getAllSubscriptionPackages = async () => {
  const packages = await prisma.subscriptionPackage.findMany({
    where: { isActive: true },
    orderBy: [
      { name: "asc" },
      { duration: "asc" }
    ],
  });

  return packages;
};

// Membuat paket subscription baru
export const createSubscriptionPackage = async (packageData) => {
  const { name, displayName, duration, price, maxUsers, maxMembers, maxStores } = packageData;

  if (!name || !displayName || !duration || !price) {
    throw new Error("Nama, displayName, durasi, dan harga paket diperlukan");
  }
  const existingPackage = await prisma.subscriptionPackage.findFirst({
    where: {
      name,
      duration: parseInt(duration),
    },
  });

  if (existingPackage) {
    throw new Error(`Paket ${name} dengan durasi ${duration} bulan sudah ada`);
  }
  const newPackage = await prisma.subscriptionPackage.create({
    data: {
      name: name.toUpperCase(),
      displayName,
      duration: parseInt(duration),
      price: parseFloat(price),
      maxUsers: parseInt(maxUsers || 1),
      maxMembers: parseInt(maxMembers || 3),
      maxStores: parseInt(maxStores || 1),
      isActive: true,
    },
  });

  return newPackage;
};

// Memperbarui paket subscription
export const updateSubscriptionPackage = async (packageId, packageData) => {
  const { displayName, price, maxUsers, maxMembers, maxStores, isActive } = packageData;

  if (!packageId) {
    throw new Error("ID paket diperlukan");
  }

  const existingPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!existingPackage) {
    throw new Error("Paket tidak ditemukan");
  }

  // Update paket
  const updatedPackage = await prisma.subscriptionPackage.update({
    where: { id: packageId },
    data: {
      displayName: displayName || existingPackage.displayName,
      price: price !== undefined ? parseFloat(price) : existingPackage.price,
      maxUsers: maxUsers !== undefined ? parseInt(maxUsers) : existingPackage.maxUsers,
      maxMembers: maxMembers !== undefined ? parseInt(maxMembers) : existingPackage.maxMembers,
      maxStores: maxStores !== undefined ? parseInt(maxStores) : existingPackage.maxStores,
      isActive: isActive !== undefined ? isActive : existingPackage.isActive,
    },
  });

  return updatedPackage;
};

// Menghapus paket subscription (soft delete)
export const deleteSubscriptionPackage = async (packageId) => {
  // Validasi input
  if (!packageId) {
    throw new Error("ID paket diperlukan");
  }

  // Cek apakah paket ada
  const existingPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!existingPackage) {
    throw new Error("Paket tidak ditemukan");
  }
  const activeSubscriptions = await prisma.subscribe.count({
    where: {
      packageId,
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: { gte: new Date() },
    },
  });

  if (activeSubscriptions > 0) {
    const updatedPackage = await prisma.subscriptionPackage.update({
      where: { id: packageId },
      data: {
        isActive: false,
      },
    });

    return {
      package: updatedPackage,
      message: `Paket ${existingPackage.displayName} dinonaktifkan karena masih digunakan oleh ${activeSubscriptions} subscription aktif`,
    };
  }
  await prisma.subscriptionPackage.delete({
    where: { id: packageId },
  });

  return {
    message: `Paket ${existingPackage.displayName} berhasil dihapus`,
  };
};

// Get all active subscribers with stores and members
export const getActiveSubscribers = async () => {
  const activeSubscribers = await prisma.user.findMany({
    where: {
      role: "USER",
      subscriptions: {
        some: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
      },
    },
    include: {
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
        include: {
          package: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      stores: {
        where: { isActive: true },
        include: {
          members: {
            where: { isActive: true },
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
          },
          _count: {
            select: {
              products: true,
              categories: true,
              customers: true,
            },
          },
        },
      },
      _count: {
        select: {
          payments: {
            where: { status: "SUCCESS" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate additional stats
  const enrichedData = activeSubscribers.map(user => {
    const subscription = user.subscriptions[0];
    const daysLeft = subscription 
      ? Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      ...user,
      currentSubscription: subscription,
      daysLeft,
      isExpiringSoon: daysLeft <= 7,
      totalStores: user.stores.length,
      totalMembers: user.stores.reduce((sum, store) => sum + store.members.length, 0),
      totalProducts: user.stores.reduce((sum, store) => sum + store._count.products, 0),
      successfulPayments: user._count.payments,
    };
  });

  return enrichedData;
};

// Update user subscription package
export const updateUserSubscription = async (userId, newPackageId, adminId) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId, role: "ADMIN" },
  });

  if (!admin) {
    throw new Error("Hanya admin yang dapat mengubah subscription");
  }

  // Get user and current subscription
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  const currentSubscription = user.subscriptions[0];
  if (!currentSubscription) {
    throw new Error("User tidak memiliki subscription aktif");
  }

  // Get new package
  const newPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: newPackageId },
  });

  if (!newPackage) {
    throw new Error("Package baru tidak ditemukan");
  }

  // Update subscription
  const updatedSubscription = await prisma.subscribe.update({
    where: { id: currentSubscription.id },
    data: {
      packageId: newPackageId,
      isUpgrade: true,
      previousPackageId: currentSubscription.packageId,
    },
    include: {
      package: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    subscription: updatedSubscription,
    message: `Subscription berhasil diubah ke ${newPackage.displayName}`,
    previousPackage: currentSubscription.package?.displayName,
    newPackage: newPackage.displayName,
  };
};

// Extend subscription duration
export const extendSubscription = async (userId, additionalDays, adminId) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId, role: "ADMIN" },
  });

  if (!admin) {
    throw new Error("Hanya admin yang dapat memperpanjang subscription");
  }

  // Get user and current subscription
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIAL"] },
          endDate: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  const currentSubscription = user.subscriptions[0];
  if (!currentSubscription) {
    throw new Error("User tidak memiliki subscription aktif");
  }

  // Calculate new end date
  const currentEndDate = currentSubscription.endDate;
  const newEndDate = new Date(currentEndDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

  // Update subscription
  const updatedSubscription = await prisma.subscribe.update({
    where: { id: currentSubscription.id },
    data: {
      endDate: newEndDate,
      bonusMonths: currentSubscription.bonusMonths + Math.round(additionalDays / 30),
      totalMonths: currentSubscription.totalMonths + Math.round(additionalDays / 30),
    },
    include: {
      package: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    subscription: updatedSubscription,
    message: `Subscription berhasil diperpanjang ${additionalDays} hari`,
    oldEndDate: currentEndDate,
    newEndDate: newEndDate,
    additionalDays,
  };
};

// Delete user account (Admin only)
export const deleteUserAccount = async (userId, adminId) => {
  // Verify admin permission
  const admin = await prisma.user.findUnique({
    where: { id: adminId, role: "ADMIN" },
  });

  if (!admin) {
    throw new Error("Hanya admin yang dapat menghapus akun");
  }

  if (userId === adminId) {
    throw new Error("Admin tidak dapat menghapus akun sendiri");
  }

  // Get user with related data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      stores: {
        include: {
          members: true,
        },
      },
      subscriptions: true,
      payments: true,
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  if (user.role === "ADMIN") {
    throw new Error("Tidak dapat menghapus akun admin lain");
  }

  // Delete user (cascade will handle related data)
  await prisma.user.delete({
    where: { id: userId },
  });

  return {
    deletedUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      storesCount: user.stores.length,
      membersCount: user.stores.reduce((sum, store) => sum + store.members.length, 0),
      subscriptionsCount: user.subscriptions.length,
      paymentsCount: user.payments.length,
    },
    message: `Akun ${user.name} berhasil dihapus beserta semua data terkait`,
  };
};

// Delete store member
export const deleteStoreMember = async (memberId, adminId) => {
  // Verify admin permission
  const admin = await prisma.user.findUnique({
    where: { id: adminId, role: "ADMIN" },
  });

  if (!admin) {
    throw new Error("Hanya admin yang dapat menghapus member");
  }

  // Get member
  const member = await prisma.storeMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      store: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error("Member tidak ditemukan");
  }

  // Soft delete member
  await prisma.storeMember.update({
    where: { id: memberId },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  return {
    deletedMember: {
      id: member.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      storeName: member.store.name,
    },
    message: `Member ${member.user.name} berhasil dihapus dari toko ${member.store.name}`,
  };
};

// Get dashboard statistics
export const getAdminDashboardStats = async () => {
  const [
    totalUsers,
    activeSubscriptions,
    expiredSubscriptions,
    totalStores,
    totalMembers,
    totalPayments,
    revenueStats,
  ] = await Promise.all([
    // Total users
    prisma.user.count({
      where: { role: { in: ["USER", "MEMBER"] } },
    }),

    // Active subscriptions
    prisma.subscribe.count({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
        endDate: { gte: new Date() },
      },
    }),

    // Expired subscriptions
    prisma.subscribe.count({
      where: {
        status: "EXPIRED",
      },
    }),

    // Total stores
    prisma.store.count({
      where: { isActive: true },
    }),

    // Total members
    prisma.storeMember.count({
      where: { isActive: true },
    }),

    // Total successful payments
    prisma.payment.count({
      where: { status: "SUCCESS" },
    }),

    // Revenue statistics
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: {
        paymentAmount: true,
      },
      _count: true,
    }),
  ]);

  // Get expiring subscriptions (next 7 days)
  const expiringSoon = await prisma.subscribe.count({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  // Get package distribution
  const packageDistribution = await prisma.subscribe.groupBy({
    by: ['packageId'],
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: { gte: new Date() },
    },
    _count: true,
  });

  // Get package names for distribution
  const packagesWithCounts = await Promise.all(
    packageDistribution.map(async (item) => {
      const package_ = await prisma.subscriptionPackage.findUnique({
        where: { id: item.packageId },
        select: { name: true, displayName: true },
      });
      return {
        packageName: package_?.name || 'Unknown',
        displayName: package_?.displayName || 'Unknown',
        count: item._count,
      };
    })
  );

  return {
    overview: {
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      totalStores,
      totalMembers,
      totalPayments,
      expiringSoon,
    },
    revenue: {
      totalRevenue: revenueStats._sum.paymentAmount || 0,
      totalTransactions: revenueStats._count || 0,
      averageRevenue: revenueStats._count 
        ? (revenueStats._sum.paymentAmount || 0) / revenueStats._count 
        : 0,
    },
    packageDistribution: packagesWithCounts,
    timestamp: new Date().toISOString(),
  };
};