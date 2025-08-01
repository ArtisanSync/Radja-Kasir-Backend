import prisma from "../config/prisma.js";

// Create new store
export const createStore = async (storeData, user) => {
  const { name, storeType, address, whatsapp, logo, stamp } = storeData;

  // Check if store name already exists for this user
  const existingStore = await prisma.store.findFirst({
    where: {
      name,
      userId: user.id,
    },
  });

  if (existingStore) {
    throw new Error("Store with this name already exists");
  }

  // Create store
  const store = await prisma.store.create({
    data: {
      name: name.trim(),
      storeType: storeType?.trim() || null,
      address: address?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      logo: logo?.trim() || null,
      stamp: stamp?.trim() || null,
      userId: user.id,
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

  return store;
};

// Get all stores for a user
export const getUserStores = async (user) => {
  const stores = await prisma.store.findMany({
    where: {
      userId: user.id,
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

// Get store by ID
export const getStoreById = async (storeId, user) => {
  // For admin, can access any store
  if (user.role === "ADMIN") {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
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
    });

    if (!store) {
      throw new Error("Store not found");
    }

    return store;
  }

  // For regular users, only access their own stores
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId: user.id,
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
    throw new Error(
      "Store not found or you don't have permission to access it"
    );
  }

  return store;
};

// Update store
export const updateStore = async (storeId, updateData, user) => {
  const { name, storeType, address, whatsapp, logo, stamp } = updateData;

  // Verify store ownership (admin can update any store)
  const existingStore = await prisma.store.findFirst({
    where: {
      id: storeId,
      ...(user.role !== "ADMIN" && { userId: user.id }),
    },
  });

  if (!existingStore) {
    throw new Error(
      "Store not found or you don't have permission to access it"
    );
  }

  // Check if new store name conflicts with existing stores for this user
  if (name && name.trim() !== existingStore.name) {
    const nameConflict = await prisma.store.findFirst({
      where: {
        name: name.trim(),
        userId: existingStore.userId,
        id: { not: storeId },
      },
    });

    if (nameConflict) {
      throw new Error("Store with this name already exists");
    }
  }

  // Update store
  const updatedStore = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(name && { name: name.trim() }),
      ...(storeType !== undefined && { storeType: storeType?.trim() || null }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(whatsapp !== undefined && { whatsapp: whatsapp?.trim() || null }),
      ...(logo !== undefined && { logo: logo?.trim() || null }),
      ...(stamp !== undefined && { stamp: stamp?.trim() || null }),
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

// Delete store
export const deleteStore = async (storeId, user) => {
  // Verify store ownership (admin can delete any store)
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      ...(user.role !== "ADMIN" && { userId: user.id }),
    },
  });

  if (!store) {
    throw new Error(
      "Store not found or you don't have permission to access it"
    );
  }

  // Delete store (cascade delete will handle related records)
  await prisma.store.delete({
    where: { id: storeId },
  });

  return { message: "Store deleted successfully" };
};

// Get all stores (admin only)
export const getAllStores = async (page = 1, limit = 10, search = "") => {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { storeType: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

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
