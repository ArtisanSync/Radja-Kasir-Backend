import prisma from "../config/prisma.js";

// Get all subscription packages
export const getAllPackages = async () => {
  const packages = await prisma.subscriptionPackage.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return packages;
};

// Get user's current active subscription
export const getUserActiveSubscription = async (userId) => {
  const subscription = await prisma.subscribe.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: { gte: new Date() },
    },
    include: {
      package: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return subscription;
};

export const hasActiveSubscription = async (userId) => {
  const subscription = await getUserActiveSubscription(userId);
  return !!subscription;
};

// Create subscription for NEW USER (1 bulan bayar + 1 bulan gratis = 2 bulan akses)
export const createNewUserSubscription = async (userId, packageId) => {
  const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!subscriptionPackage) {
    throw new Error("Subscription package not found");
  }

  const existingSubscription = await getUserActiveSubscription(userId);
  if (existingSubscription) {
    throw new Error("User already has an active subscription");
  }

  const hasEverSubscribed = await prisma.subscribe.count({
    where: { userId },
  });

  const isNewUser = hasEverSubscribed === 0;
  const now = new Date();
  
  // NEW USER: Bayar 1 bulan, dapat akses 2 bulan
  // EXISTING USER: Bayar 1 bulan, dapat akses 1 bulan
  const daysToAdd = isNewUser ? 60 : 30; // 60 days for new users, 30 for existing
  const endDate = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));

  const subscription = await prisma.subscribe.create({
    data: {
      userId,
      packageId,
      status: "ACTIVE",
      startDate: now,
      endDate,
      isTrial: false,
      isNewUserPromo: isNewUser,
      paidMonths: 1,
      bonusMonths: isNewUser ? 1 : 0,
      totalMonths: isNewUser ? 2 : 1,
      autoRenew: true,
    },
    include: {
      package: true,
    },
  });

  return {
    subscription,
    promotion: isNewUser ? {
      isNewUser: true,
      originalPrice: subscriptionPackage.price,
      paidMonths: 1,
      bonusMonths: 1,
      totalAccess: "2 bulan",
      message: `Promo New User: Bayar Rp ${subscriptionPackage.price.toLocaleString('id-ID')} untuk 1 bulan, dapatkan akses 2 bulan penuh!`
    } : {
      isNewUser: false,
      originalPrice: subscriptionPackage.price,
      paidMonths: 1,
      bonusMonths: 0,
      totalAccess: "1 bulan",
      message: `Subscription ${subscriptionPackage.displayName} - akses 1 bulan`
    }
  };
};

// Create regular subscription renewal (untuk existing users)
export const renewSubscription = async (userId, packageId) => {
  const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!subscriptionPackage) {
    throw new Error("Subscription package not found");
  }

  const existingSubscription = await getUserActiveSubscription(userId);
  if (existingSubscription) {
    await prisma.subscribe.update({
      where: { id: existingSubscription.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

  const subscription = await prisma.subscribe.create({
    data: {
      userId,
      packageId,
      status: "ACTIVE",
      startDate: now,
      endDate,
      isTrial: false,
      isNewUserPromo: false,
      paidMonths: 1,
      bonusMonths: 0,
      totalMonths: 1,
      autoRenew: true,
    },
    include: {
      package: true,
    },
  });

  return {
    subscription,
    message: `Subscription ${subscriptionPackage.displayName} renewed for 1 month`
  };
};

export const canCreateStore = async (userId) => {
  const subscription = await getUserActiveSubscription(userId);
  if (!subscription) {
    return { 
      canCreate: false, 
      reason: "Tidak ada subscription aktif. Silakan berlangganan terlebih dahulu.",
      requiresUpgrade: true,
      currentPackage: null
    };
  }

  const storeCount = await prisma.store.count({
    where: { userId, isActive: true },
  });

  if (storeCount >= subscription.package.maxStores) {
    return {
      canCreate: false,
      reason: `Paket ${subscription.package.displayName} hanya mengizinkan ${subscription.package.maxStores} toko. Upgrade paket untuk menambah toko.`,
      requiresUpgrade: true,
      currentCount: storeCount,
      maxAllowed: subscription.package.maxStores,
      currentPackage: subscription.package.name,
      suggestedPackages: getSuggestedUpgrade(subscription.package.name)
    };
  }

  return { canCreate: true };
};

export const canAddMember = async (storeId, userId) => {
  const subscription = await getUserActiveSubscription(userId);
  if (!subscription) {
    return { 
      canAdd: false, 
      reason: "Tidak ada subscription aktif untuk menambah member.",
      requiresUpgrade: true
    };
  }

  const memberCount = await prisma.storeMember.count({
    where: { storeId, isActive: true },
  });

  if (memberCount >= subscription.package.maxMembers) {
    return {
      canAdd: false,
      reason: `Paket ${subscription.package.displayName} hanya mengizinkan ${subscription.package.maxMembers} member. Upgrade paket untuk menambah member.`,
      requiresUpgrade: true,
      currentCount: memberCount,
      maxAllowed: subscription.package.maxMembers,
      currentPackage: subscription.package.name,
      suggestedPackages: getSuggestedUpgrade(subscription.package.name)
    };
  }

  return { canAdd: true };
};

// Get suggested upgrade packages
const getSuggestedUpgrade = (currentPackage) => {
  const upgradeMap = {
    "STANDARD": ["PRO", "BUSINESS"],
    "PRO": ["BUSINESS"],
    "BUSINESS": []
  };
  
  return upgradeMap[currentPackage] || [];
};

// Check subscription status
export const checkSubscriptionStatus = async (userId) => {
  const subscription = await getUserActiveSubscription(userId);
  
  if (!subscription) {
    return { 
      isActive: false, 
      status: "NO_SUBSCRIPTION",
      message: "Tidak ada subscription aktif. Silakan berlangganan untuk mengakses fitur.",
      hasAccess: false,
      subscription: null
    };
  }

  const now = new Date();
  const daysLeft = Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24));

  return {
    isActive: true,
    status: subscription.status,
    subscription,
    daysLeft,
    isExpiring: daysLeft <= 7,
    hasAccess: true,
    accessDetails: {
      maxStores: subscription.package.maxStores,
      maxMembers: subscription.package.maxMembers,
      features: subscription.package.features
    }
  };
};