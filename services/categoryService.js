import prisma from "../config/prisma.js";

// Create new category
export const createCategory = async (categoryData, user) => {
  const { name, storeId } = categoryData;

  // Verify store ownership
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId: user.id,
    },
  });

  if (!store) {
    throw new Error(
      "Store not found or you don't have permission to access it"
    );
  }

  // Check if category name already exists in this store
  const existingCategory = await prisma.category.findFirst({
    where: {
      name,
      storeId,
    },
  });

  if (existingCategory) {
    throw new Error("Category with this name already exists in this store");
  }

  const category = await prisma.category.create({
    data: {
      name,
      storeId,
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return category;
};

// Get all categories for user's stores
export const getUserCategories = async (user) => {
  const whereClause =
    user.role === "ADMIN"
      ? {}
      : {
          store: {
            userId: user.id,
          },
        };

  const categories = await prisma.category.findMany({
    where: whereClause,
    include: {
      store: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return categories;
};

// Get categories by store ID
export const getCategoriesByStore = async (storeId, user) => {
  // Verify store access
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

  const categories = await prisma.category.findMany({
    where: {
      storeId,
    },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return categories;
};

// Get single category
export const getCategoryById = async (categoryId, user) => {
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
      products: {
        select: {
          id: true,
          name: true,
          image: true,
          active: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  // Check access permission
  if (user.role !== "ADMIN" && category.store.userId !== user.id) {
    throw new Error("You don't have permission to access this category");
  }

  return category;
};

// Update category
export const updateCategory = async (categoryId, updateData, user) => {
  const { name } = updateData;

  // Get current category and verify ownership
  const currentCategory = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      store: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!currentCategory) {
    throw new Error("Category not found");
  }

  if (user.role !== "ADMIN" && currentCategory.store.userId !== user.id) {
    throw new Error("You don't have permission to update this category");
  }

  // Check if new name already exists in the same store (excluding current category)
  if (name) {
    const existingCategory = await prisma.category.findFirst({
      where: {
        name,
        storeId: currentCategory.storeId,
        id: {
          not: categoryId,
        },
      },
    });

    if (existingCategory) {
      throw new Error("Category with this name already exists in this store");
    }
  }

  const updatedCategory = await prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      ...(name && { name }),
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return updatedCategory;
};

// Delete category
export const deleteCategory = async (categoryId, user) => {
  // Get category and verify ownership
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      store: {
        select: {
          userId: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  if (user.role !== "ADMIN" && category.store.userId !== user.id) {
    throw new Error("You don't have permission to delete this category");
  }

  // Check if category has products
  if (category._count.products > 0) {
    throw new Error(
      "Cannot delete category that contains products. Please move or delete products first."
    );
  }

  await prisma.category.delete({
    where: {
      id: categoryId,
    },
  });

  return {
    deletedCategory: category.name,
    message: "Category deleted successfully",
  };
};
