import prisma from "../config/prisma.js";
import { createNewUserSubscription } from "./subscriptionService.js";
import {
  uploadStoreLogoToStorage,
  uploadStoreStampToStorage,
  deleteFileFromStorage,
} from "../config/storage.js";

export const createFirstStore = async (storeData, user, packageId = null) => {
  const { name, storeType, description, address, phone, whatsapp, email, logo, stamp } = storeData;

  const existingStoreCount = await prisma.store.count({
    where: { userId: user.id, isActive: true },
  });

  if (existingStoreCount > 0) {
    throw new Error("You already have a store. Use regular create store endpoint.");
  }

  if (!packageId) {
    const standardPackage = await prisma.subscriptionPackage.findFirst({
      where: { name: "STANDARD" },
    });
    packageId = standardPackage?.id;
  }

  if (!packageId) {
    throw new Error("No subscription package available");
  }
  const existingStore = await prisma.store.findFirst({
    where: {
      name: name.trim(),
      userId: user.id,
    },
  });

  if (existingStore) {
    throw new Error("Store with this name already exists");
  }

  let logoUrl = null;
  let stampUrl = null;

  const result = await prisma.$transaction(async (tx) => {
    // Create store
    const store = await tx.store.create({
      data: {
        name: name.trim(),
        storeType: storeType?.trim() || null,
        description: description?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        userId: user.id,
      },
    });

    if (logo) {
      try {
        logoUrl = await uploadStoreLogoToStorage(logo, store.id, store.id, store.name);
      } catch (error) {
        throw new Error("Failed to upload store logo");
      }
    }

    if (stamp) {
      try {
        stampUrl = await uploadStoreStampToStorage(stamp, store.id, store.id, store.name);
      } catch (error) {
        throw new Error("Failed to upload store stamp");
      }
    }

    // Update store with images
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: { 
        logo: logoUrl, 
        stamp: stampUrl 
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create store settings
    await tx.storeSetting.create({
      data: {
        storeId: store.id,
        tax: 0,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    });

    return updatedStore;
  });

  return {
    store: result,
    requiresPayment: true,
    packageId: packageId,
    message: "Store created successfully. Please complete payment to activate subscription."
  };
};

// Create additional store - dengan validation subscription
export const createStore = async (storeData, user) => {
  const { name, storeType, description, address, phone, whatsapp, email, logo, stamp } = storeData;
  const existingStoreCount = await prisma.store.count({
    where: { userId: user.id, isActive: true },
  });

  if (existingStoreCount === 0) {
    throw new Error("Please use the first store creation endpoint.");
  }

  // Check subscription limits
  const subscription = await prisma.subscribe.findFirst({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: { gte: new Date() },
    },
    include: {
      package: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new Error("No active subscription found. Please subscribe to create additional stores.");
  }

  if (existingStoreCount >= subscription.package.maxStores) {
    throw new Error(
      `Maximum ${subscription.package.maxStores} stores allowed for ${subscription.package.displayName}. Please upgrade your subscription.`
    );
  }

  const existingStore = await prisma.store.findFirst({
    where: {
      name: name.trim(),
      userId: user.id,
    },
  });

  if (existingStore) {
    throw new Error("Store with this name already exists");
  }

  let logoUrl = null;
  let stampUrl = null;

  const result = await prisma.$transaction(async (tx) => {
    // Create store
    const store = await tx.store.create({
      data: {
        name: name.trim(),
        storeType: storeType?.trim() || null,
        description: description?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        userId: user.id,
      },
    });

    if (logo) {
      try {
        logoUrl = await uploadStoreLogoToStorage(logo, store.id, store.id, store.name);
      } catch (error) {
        throw new Error("Failed to upload store logo");
      }
    }

    if (stamp) {
      try {
        stampUrl = await uploadStoreStampToStorage(stamp, store.id, store.id, store.name);
      } catch (error) {
        throw new Error("Failed to upload store stamp");
      }
    }

    // Update store with images
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: { 
        logo: logoUrl, 
        stamp: stampUrl 
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create store settings
    await tx.storeSetting.create({
      data: {
        storeId: store.id,
        tax: 0,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    });

    return updatedStore;
  });

  return result;
};

// Get all stores for a user
export const getUserStores = async (user) => {
  const stores = await prisma.store.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      settings: true,
      _count: {
        select: {
          categories: true,
          products: true,
          customers: true,
          orders: true,
          members: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return stores;
};

// Get store by ID with access control
export const getStoreById = async (storeId, user) => {
  const where = {
    id: storeId,
    isActive: true,
  };

  if (user.role !== "ADMIN") {
    where.OR = [
      { userId: user.id },
      { members: { some: { userId: user.id, isActive: true } } }
    ];
  }

  const store = await prisma.store.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      settings: true,
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
        orderBy: { joinedAt: "desc" },
      },
      _count: {
        select: {
          categories: true,
          products: true,
          customers: true,
          orders: true,
          members: true,
        },
      },
    },
  });

  if (!store) {
    throw new Error("Store not found or you don't have permission to access it");
  }

  return store;
};

// Update store
export const updateStore = async (storeId, updateData, user) => {
  const { name, storeType, description, address, phone, whatsapp, email, logo, stamp } = updateData;

  const existingStore = await getStoreById(storeId, user);

  if (name && name.trim() !== existingStore.name) {
    const nameConflict = await prisma.store.findFirst({
      where: {
        name: name.trim(),
        userId: existingStore.userId,
        id: { not: storeId },
        isActive: true,
      },
    });

    if (nameConflict) {
      throw new Error("Store with this name already exists");
    }
  }

  let logoUrl = existingStore.logo;
  let stampUrl = existingStore.stamp;

  // Handle logo upload
  if (logo) {
    try {
      logoUrl = await uploadStoreLogoToStorage(
        logo,
        storeId,
        storeId,
        name || existingStore.name
      );
      if (existingStore.logo) {
        await deleteFileFromStorage(existingStore.logo);
      }
    } catch (error) {
      console.error("Logo upload failed:", error);
      throw new Error("Failed to upload store logo");
    }
  }

  if (stamp) {
    try {
      stampUrl = await uploadStoreStampToStorage(
        stamp,
        storeId,
        storeId,
        name || existingStore.name
      );
      if (existingStore.stamp) {
        await deleteFileFromStorage(existingStore.stamp);
      }
    } catch (error) {
      console.error("Stamp upload failed:", error);
      throw new Error("Failed to upload store stamp");
    }
  }

  // Update store
  const updatedStore = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(name && { name: name.trim() }),
      ...(storeType !== undefined && { storeType: storeType?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(whatsapp !== undefined && { whatsapp: whatsapp?.trim() || null }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(logoUrl !== existingStore.logo && { logo: logoUrl }),
      ...(stampUrl !== existingStore.stamp && { stamp: stampUrl }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      settings: true,
      _count: {
        select: {
          categories: true,
          products: true,
          customers: true,
          orders: true,
          members: true,
        },
      },
    },
  });

  return updatedStore;
};

// Delete store (soft delete)
export const deleteStore = async (storeId, user) => {
  const store = await getStoreById(storeId, user);

  if (user.role !== "ADMIN" && store.userId !== user.id) {
    throw new Error("Only store owner can delete this store");
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { 
      isActive: false,
      name: `${store.name} (Deleted)`,
    },
  });

  return { message: "Store deleted successfully" };
};

// Get all stores (admin only)
export const getAllStores = async (page = 1, limit = 10, search = "") => {
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { storeType: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            categories: true,
            products: true,
            customers: true,
            orders: true,
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.store.count({ where }),
  ]);

  return {
    stores,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
    },
  };
};
