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
    storeId,
  } = productData;

  if (!name || name.trim().length === 0) {
    throw new Error("Product name is required");
  }

  if (!price || parseFloat(price) <= 0) {
    throw new Error("Selling price must be greater than 0");
  }

  if (capitalPrice && parseFloat(capitalPrice) < 0) {
    throw new Error("Capital price cannot be negative");
  }

  if (capitalPrice && price && parseFloat(capitalPrice) > parseFloat(price)) {
    throw new Error("Capital price should not exceed selling price");
  }

  if (quantity && parseInt(quantity) < 0) {
    throw new Error("Quantity cannot be negative");
  }

  // Validate discount
  const numDiscountPercent = parseFloat(discountPercent) || 0;
  const numDiscountRp = parseFloat(discountRp) || 0;

  if (numDiscountPercent > 0 && numDiscountRp > 0) {
    throw new Error(
      "Cannot apply both percentage and amount discount simultaneously"
    );
  }

  if (numDiscountPercent < 0 || numDiscountPercent > 100) {
    throw new Error("Discount percentage must be between 0-100");
  }

  if (numDiscountRp < 0) {
    throw new Error("Discount amount must be positive");
  }

  if (numDiscountRp >= parseFloat(price)) {
    throw new Error("Discount amount cannot exceed selling price");
  }

  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [{ userId: userId }, { members: { some: { userId: userId } } }],
    },
  });

  if (!store) {
    throw new Error("Store not found or you don't have access");
  }

  // Validate unit exists
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });
  if (!unit) {
    throw new Error("Unit not found");
  }

  if (code) {
    const existingProduct = await prisma.product.findFirst({
      where: { code, storeId, isActive: true },
    });
    if (existingProduct) {
      throw new Error("Product code already exists in this store");
    }
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId },
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
        folder: `/products/${store.id}`,
        useUniqueFileName: true,
        transformation: { pre: "w-500,h-500,c-maintain_ratio" },
      });
      imageUrl = uploadResponse.url;
    } catch (error) {
      throw new Error("Failed to upload product image");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: name.trim(),
        code: code || null,
        brand: brand || null,
        image: imageUrl,
        categoryId: categoryId || null,
        storeId,
      },
    });

    await tx.productVariant.create({
      data: {
        productId: product.id,
        unitId,
        name: "Default",
        quantity: parseInt(quantity) || 0,
        capitalPrice: parseFloat(capitalPrice) || 0,
        price: parseFloat(price) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
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
    stockThreshold = 10,
  } = filters;

  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      OR: [{ userId: userId }, { members: { some: { userId: userId } } }],
    },
  });
  if (!store) {
    throw new Error("Store not found or you don't have access");
  }

  const where = {
    storeId,
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(categoryId && { categoryId }),
    ...(isFavorite !== undefined && { isFavorite: isFavorite === "true" }),
    ...(lowStock && {
      variants: {
        some: {
          quantity: { lte: parseInt(stockThreshold) },
        },
      },
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
      OR: [{ userId: userId }, { members: { some: { userId: userId } } }],
    },
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
    isActive,
    isFavorite,
  } = updateData;

  if (name !== undefined) {
    if (!name || name.trim().length === 0) {
      throw new Error("Product name cannot be empty");
    }
  }

  if (price !== undefined) {
    if (parseFloat(price) <= 0) {
      throw new Error("Selling price must be greater than 0");
    }
  }

  if (capitalPrice !== undefined) {
    if (parseFloat(capitalPrice) < 0) {
      throw new Error("Capital price cannot be negative");
    }
  }

  if (quantity !== undefined) {
    if (parseInt(quantity) < 0) {
      throw new Error("Quantity cannot be negative");
    }
  }
  const currentVariant = existingProduct.variants[0] || {};
  const currentPrice =
    price !== undefined
      ? parseFloat(price)
      : parseFloat(currentVariant.price || 0);
  const currentCapitalPrice =
    capitalPrice !== undefined
      ? parseFloat(capitalPrice)
      : parseFloat(currentVariant.capitalPrice || 0);
  const currentDiscountPercent =
    discountPercent !== undefined
      ? parseFloat(discountPercent)
      : parseFloat(currentVariant.discountPercent || 0);
  const currentDiscountRp =
    discountRp !== undefined
      ? parseFloat(discountRp)
      : parseFloat(currentVariant.discountRp || 0);

  if (discountPercent !== undefined || discountRp !== undefined) {
    if (currentDiscountPercent > 0 && currentDiscountRp > 0) {
      throw new Error(
        "Cannot apply both percentage and amount discount simultaneously"
      );
    }

    if (currentDiscountPercent < 0 || currentDiscountPercent > 100) {
      throw new Error("Discount percentage must be between 0-100");
    }

    if (currentDiscountRp < 0) {
      throw new Error("Discount amount must be positive");
    }

    if (currentDiscountRp >= currentPrice) {
      throw new Error("Discount amount cannot exceed selling price");
    }
  }

  if (
    (capitalPrice !== undefined || price !== undefined) &&
    currentCapitalPrice > currentPrice
  ) {
    throw new Error("Capital price should not exceed selling price");
  }
  if (code !== undefined && code !== existingProduct.code) {
    const codeExists = await prisma.product.findFirst({
      where: {
        code,
        storeId: existingProduct.storeId,
        id: { not: productId },
        isActive: true,
      },
    });
    if (codeExists) {
      throw new Error("Product code already exists in this store");
    }
  }
  if (categoryId !== undefined && categoryId !== null) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId: existingProduct.storeId },
    });
    if (!category) {
      throw new Error("Category not found in this store");
    }
  }
  if (unitId !== undefined) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
    });
    if (!unit) {
      throw new Error("Unit not found");
    }
  }

  let imageUrl = existingProduct.image;

  if (file) {
    try {
      const uploadResponse = await imagekit.upload({
        file: file.buffer,
        fileName: `product_${productId}_${Date.now()}`,
        folder: `/products/${existingProduct.storeId}`,
        useUniqueFileName: true,
        transformation: { pre: "w-500,h-500,c-maintain_ratio" },
      });
      imageUrl = uploadResponse.url;
    } catch (error) {
      throw new Error("Failed to upload product image");
    }
  }

  const parseBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return Boolean(value);
  };

  // Update product and variant in transaction
  const result = await prisma.$transaction(async (tx) => {
    const productUpdateData = {};

    if (name !== undefined) productUpdateData.name = name.trim();
    if (code !== undefined) productUpdateData.code = code;
    if (brand !== undefined) productUpdateData.brand = brand;
    if (file) productUpdateData.image = imageUrl;
    if (categoryId !== undefined) productUpdateData.categoryId = categoryId;
    if (isActive !== undefined)
      productUpdateData.isActive = parseBoolean(isActive);
    if (isFavorite !== undefined)
      productUpdateData.isFavorite = parseBoolean(isFavorite);
    let product = existingProduct;
    if (Object.keys(productUpdateData).length > 0) {
      product = await tx.product.update({
        where: { id: productId },
        data: productUpdateData,
        include: {
          category: true,
          variants: {
            include: {
              unit: true,
            },
          },
        },
      });
    }

    const variantUpdateData = {};

    if (unitId !== undefined) variantUpdateData.unitId = unitId;
    if (quantity !== undefined) variantUpdateData.quantity = parseInt(quantity);
    if (capitalPrice !== undefined)
      variantUpdateData.capitalPrice = parseFloat(capitalPrice);
    if (price !== undefined) variantUpdateData.price = parseFloat(price);
    if (discountPercent !== undefined)
      variantUpdateData.discountPercent = parseFloat(discountPercent);
    if (discountRp !== undefined)
      variantUpdateData.discountRp = parseFloat(discountRp);
    if (file) variantUpdateData.image = imageUrl;
    if (
      Object.keys(variantUpdateData).length > 0 &&
      existingProduct.variants.length > 0
    ) {
      await tx.productVariant.update({
        where: { id: existingProduct.variants[0].id },
        data: variantUpdateData,
      });
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

export const deleteProduct = async (productId, userId) => {
  const product = await getProductById(productId, userId);

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return {
    deletedProduct: product.name,
  };
};

// Get units for dropdown
export const getAllUnits = async () => {
  const units = await prisma.unit.findMany({
    orderBy: { name: "asc" },
  });

  return units;
};
