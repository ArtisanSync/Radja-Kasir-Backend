import prisma from "../config/prisma.js";
import { canCreateStore } from "./subscriptionService.js";

// Create first store dengan pengecekan subscription
export const createFirstStore = async (storeData) => {
  const { userId } = storeData;

  const existingStores = await prisma.store.count({
    where: { userId, isActive: true },
  });

  if (existingStores > 0) {
    throw new Error("You already have stores. Use the regular create store endpoint.");
  }
  const canCreate = await canCreateStore(userId);
  if (!canCreate.canCreate) {
    throw new Error(canCreate.reason);
  }

  const store = await prisma.store.create({
    data: {
      ...storeData,
      storeType: "RETAIL",
      isActive: true,
    },
  });

  return store;
};

// Create additional store
export const createStore = async (storeData) => {
  const { userId } = storeData;
  const canCreate = await canCreateStore(userId);
  if (!canCreate.canCreate) {
    throw new Error(canCreate.reason);
  }

  const store = await prisma.store.create({
    data: {
      ...storeData,
      storeType: "RETAIL", // default
      isActive: true,
    },
  });

  return store;
};

// Get user's stores
export const getUserStores = async (userId) => {
  const stores = await prisma.store.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      address: true,
      phone: true,
      whatsapp: true,
      email: true,
      logo: true,
      stamp: true,
      storeType: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          products: true,
          categories: true,
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

// Get store by ID
export const getStoreById = async (storeId, userId) => {
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [
        { userId }, // Owner
        {
          members: {
            some: {
              userId,
              isActive: true,
            },
          },
        }, // Member
      ],
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
      _count: {
        select: {
          products: true,
          categories: true,
          members: true,
        },
      },
    },
  });

  if (!store) {
    throw new Error("Store not found or you don't have access to this store");
  }

  return store;
};

// Update store
export const updateStore = async (storeId, userId, updateData) => {
  const existingStore = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId,
      isActive: true,
    },
  });

  if (!existingStore) {
    throw new Error("Store not found or you don't have permission to update this store");
  }

  const updatedStore = await prisma.store.update({
    where: {
      id: storeId,
    },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  return updatedStore;
};

// Delete store (soft delete)
export const deleteStore = async (storeId, userId) => {
  const existingStore = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId,
      isActive: true,
    },
  });

  if (!existingStore) {
    throw new Error("Store not found or you don't have permission to delete this store");
  }

  const deletedStore = await prisma.store.update({
    where: {
      id: storeId,
    },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  return { message: "Store deleted successfully", store: deletedStore };
};

// Admin: Get all stores with pagination
export const getAllStores = async (page = 1, limit = 10, search = "") => {
  const skip = (page - 1) * limit;
  
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [stores, totalStores] = await Promise.all([
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
            products: true,
            categories: true,
            members: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.store.count({ where }),
  ]);

  return {
    stores,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalStores / limit),
      totalStores,
      limit,
    },
  };
};