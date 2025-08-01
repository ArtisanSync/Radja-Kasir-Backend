import prisma from "../config/prisma.js";
import imagekit from "../config/imagekit.js";

// Create new product with variant
export const createProduct = async (productData, file, userId) => {
  const {
    name,
    code,
    brand,
    categoryId,
    unitId,
    capitalPrice,
    price,
    discountPercent = 0,
    discountRp = 0,
    quantity,
    storeId
  } = productData;
  const store = await prisma.store.findFirst({
    where: { 
      id: storeId,
      OR: [
        { userId: userId },
        { members: { some: { userId: userId } } }
      ]
    }
  });

  if (!store) {
    throw new Error("Store not found or you don't have access");
  }

  // Validate unit exists
  const unit = await prisma.unit.findUnique({
    where: { id: unitId }
  });
  if (!unit) {
    throw new Error("Unit not found");
  }
  if (code) {
    const existingProduct = await prisma.product.findFirst({
      where: { code, storeId }
    });
    if (existingProduct) {
      throw new Error("Product code already exists in this store");
    }
  }
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId }
    });
    if (!category) {
      throw new Error("Category not found in this store");
    }
  }

  let imageUrl = null;

  if (file) {
    try {
      const uploadResponse = await imagekit.upload({
        file: file.buffer,
        fileName: `product_${Date.now()}`,
        folder: "/products",
        useUniqueFileName: true,
        transformation: { pre: "w-500,h-500,c-maintain_ratio" },
      });
      imageUrl = uploadResponse.url;
    } catch (error) {
      console.error("Image upload failed:", error);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name,
        code: code || null,
        brand: brand || null,
        image: imageUrl,
        categoryId: categoryId || null,
        storeId,
      },
    });

    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        unitId,
        name: "Default",
        quantity: parseInt(quantity) || 0,
        capitalPrice: parseFloat(capitalPrice) || 0,
        price: parseFloat(price) || 0,
        discountPercent: parseInt(discountPercent) || 0,
        discountRp: parseFloat(discountRp) || 0,
        image: imageUrl,
      },
    });

    return await tx.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        store: true,
        variants: {
          include: {
            unit: true,
          },
        },
      },
    });
  });

  return result;
};

// Get all products by store
export const getProductsByStore = async (storeId, userId, filters = {}) => {
  const { 
    search, 
    categoryId, 
    page = 1, 
    limit = 20, 
    isFavorite,
    lowStock,
    stockThreshold = 10
  } = filters;

  const store = await prisma.store.findFirst({
    where: { 
      id: storeId,
      OR: [
        { userId: userId },
        { members: { some: { userId: userId } } }
      ]
    }
  });

  if (!store) {
    throw new Error("Store not found or you don't have access");
  }

  const where = {
    storeId,
    active: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(categoryId && { categoryId }),
    ...(isFavorite !== undefined && { isFavorite: isFavorite === 'true' }),
    ...(lowStock && {
      variants: {
        some: {
          quantity: { lte: parseInt(stockThreshold) }
        }
      }
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: {
          include: {
            unit: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// Get product by ID
export const getProductById = async (productId, userId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      store: true,
      variants: {
        include: {
          unit: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }
  const hasAccess = await prisma.store.findFirst({
    where: { 
      id: product.storeId,
      OR: [
        { userId: userId },
        { members: { some: { userId: userId } } }
      ]
    }
  });

  if (!hasAccess) {
    throw new Error("You don't have access to this product");
  }

  return product;
};

// Update product
export const updateProduct = async (productId, updateData, file, userId) => {
  const existingProduct = await getProductById(productId, userId);

  const {
    name,
    code,
    brand,
    categoryId,
    unitId,
    capitalPrice,
    price,
    discountPercent,
    discountRp,
    quantity,
    active,
    isFavorite
  } = updateData;

  if (code && code !== existingProduct.code) {
    const codeExists = await prisma.product.findFirst({
      where: { 
        code, 
        storeId: existingProduct.storeId,
        id: { not: productId }
      }
    });
    if (codeExists) {
      throw new Error("Product code already exists in this store");
    }
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId: existingProduct.storeId }
    });
    if (!category) {
      throw new Error("Category not found in this store");
    }
  }

  if (unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId }
    });
    if (!unit) {
      throw new Error("Unit not found");
    }
  }

  if (capitalPrice && price && parseFloat(capitalPrice) > parseFloat(price)) {
    throw new Error("Capital price should not exceed selling price");
  }

  if (discountRp && price && parseFloat(discountRp) >= parseFloat(price)) {
    throw new Error("Discount amount cannot exceed selling price");
  }

  let imageUrl = existingProduct.image;

  // Upload new image if provided
  if (file) {
    try {
      const uploadResponse = await imagekit.upload({
        file: file.buffer,
        fileName: `product_${productId}_${Date.now()}`,
        folder: "/products",
        useUniqueFileName: true,
        transformation: { pre: "w-500,h-500,c-maintain_ratio" },
      });
      imageUrl = uploadResponse.url;
    } catch (error) {
      console.error("Image upload failed:", error);
    }
  }

  // Update product and variant in transaction
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ...(name && { name }),
        ...(code !== undefined && { code }),
        ...(brand !== undefined && { brand }),
        ...(imageUrl !== existingProduct.image && { image: imageUrl }),
        ...(categoryId !== undefined && { categoryId }),
        ...(active !== undefined && { active: active === 'true' || active === true }),
        ...(isFavorite !== undefined && { isFavorite: isFavorite === 'true' || isFavorite === true }),
      },
      include: {
        category: true,
        variants: {
          include: {
            unit: true,
          },
        },
      },
    });

    if (existingProduct.variants.length > 0) {
      const variantData = {};
      
      if (unitId) variantData.unitId = unitId;
      if (quantity !== undefined) variantData.quantity = parseInt(quantity);
      if (capitalPrice !== undefined) variantData.capitalPrice = parseFloat(capitalPrice);
      if (price !== undefined) variantData.price = parseFloat(price);
      if (discountPercent !== undefined) variantData.discountPercent = parseInt(discountPercent);
      if (discountRp !== undefined) variantData.discountRp = parseFloat(discountRp);
      if (imageUrl !== existingProduct.image) variantData.image = imageUrl;

      if (Object.keys(variantData).length > 0) {
        await tx.productVariant.update({
          where: { id: existingProduct.variants[0].id },
          data: variantData,
        });
      }
    }

    return await tx.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: {
          include: {
            unit: true,
          },
        },
      },
    });
  });

  return result;
};

// Toggle favorite status
export const toggleFavoriteProduct = async (productId, userId) => {
  const product = await getProductById(productId, userId);

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: { isFavorite: !product.isFavorite },
    include: {
      category: true,
      variants: {
        include: {
          unit: true,
        },
      },
    },
  });

  return updatedProduct;
};

// Delete product (soft delete)
export const deleteProduct = async (productId, userId) => {
  const product = await getProductById(productId, userId);

  await prisma.product.update({
    where: { id: productId },
    data: { active: false },
  });

  return { 
    deletedProduct: product.name
  };
};

// Get units for dropdown
export const getAllUnits = async () => {
  const units = await prisma.unit.findMany({
    orderBy: { name: "asc" },
  });

  return units;
};