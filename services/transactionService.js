import prisma from "../config/prisma.js";

/**
 * Membuat transaksi baru (Tunai atau Kasbon).
 * @param {object} transactionData
 * @param {string} storeId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const createTransaction = async (transactionData, storeId, userId) => {
  const { items, paymentMethod, notes, amountPaid, customerData } =
    transactionData;

  // 1. Validasi Input Dasar
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Transaksi harus memiliki minimal 1 item.");
  }
  if (!paymentMethod || !["TUNAI", "KASBON"].includes(paymentMethod)) {
    throw new Error(
      "Metode pembayaran tidak valid. Gunakan 'TUNAI' atau 'KASBON'."
    );
  }

  // 2. Validasi Akses Toko
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
    throw new Error("Toko tidak ditemukan atau Anda tidak memiliki akses.");
  }

  // 3. Logika Khusus untuk Kasbon
  let customerId = null;
  if (paymentMethod === "KASBON") {
    if (!customerData || !customerData.name || !customerData.phone) {
      throw new Error(
        "Data pelanggan (nama dan telepon) wajib diisi untuk transaksi kasbon."
      );
    }
    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone: customerData.phone } },
      update: {
        name: customerData.name,
        address: customerData.address,
        company: customerData.company,
        whatsapp: customerData.whatsapp,
      },
      create: {
        storeId,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        company: customerData.company,
        whatsapp: customerData.whatsapp,
      },
    });
    customerId = customer.id;
  }

  // 4. Validasi Item dan Hitung Total
  let subtotal = 0;
  const transactionItemsData = [];

  for (const item of items) {
    const { variantId, quantity } = item;
    if (!variantId || !quantity || quantity <= 0) {
      throw new Error(
        "Data item tidak valid: variantId dan quantity wajib diisi."
      );
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || variant.product.storeId !== storeId) {
      throw new Error(
        `Varian produk dengan ID ${variantId} tidak ditemukan di toko ini.`
      );
    }
    if (variant.quantity < quantity) {
      throw new Error(`Stok untuk ${variant.product.name} tidak mencukupi.`);
    }

    const itemSubtotal = variant.price * quantity;
    subtotal += itemSubtotal;
    transactionItemsData.push({
      productId: variant.productId,
      variantId: variant.id,
      name: variant.product.name,
      quantity: quantity,
      price: variant.price,
      discount: 0, // Nanti tambah Logika diskon kalau udah ada discout ditoko
      subtotal: itemSubtotal,
    });
  }

  // Ambil setting pajak dari toko
  const storeSettings = await prisma.storeSetting.findUnique({
    where: { storeId },
  });
  const taxRate = storeSettings ? parseFloat(storeSettings.tax) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // 5. Logika Pembayaran Tunai
  let change = 0;
  if (paymentMethod === "TUNAI") {
    if (amountPaid === undefined || amountPaid < total) {
      throw new Error(
        `Pembayaran kurang. Total belanja ${total}, dibayar ${amountPaid || 0}.`
      );
    }
    change = amountPaid - total;
  }

  // 6. Membuat Transaksi dalam satu operasi database (atomic)
  const result = await prisma.$transaction(async (tx) => {
    const currentStore = await tx.store.update({
      where: { id: storeId },
      data: {
        invoiceCounter: {
          increment: 1,
        },
      },
    });
    const newInvoiceNumber = currentStore.invoiceCounter.toString();

    // Buat record transaksi utama
    const newTransaction = await tx.transaction.create({
      data: {
        storeId,
        userId,
        customerId,
        invoiceNumber: newInvoiceNumber,
        status: "COMPLETED",
        subtotal,
        tax,
        discount: 0,
        total,
        paymentMethod,
        amountPaid: paymentMethod === "TUNAI" ? amountPaid : null,
        change: paymentMethod === "TUNAI" ? change : null,
        notes,
        completedAt: new Date(),
        items: {
          create: transactionItemsData,
        },
      },
    });

    // Kurangi stok untuk setiap item
    for (const item of transactionItemsData) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    // Ambil data lengkap untuk response
    return tx.transaction.findUnique({
      where: { id: newTransaction.id },
      include: {
        items: { include: { product: true } },
        customer: true,
        user: { select: { id: true, name: true } },
      },
    });
  });

  return result;
};

/**
 * Mengambil semua riwayat transaksi untuk sebuah toko dengan filter.
 * @param {string} storeId
 * @param {string} userId .
 * @param {object} filters
 * @returns {Promise<object>} .
 */
export const getHistoryAll = async (storeId, userId, filters = {}) => {
  const { page = 1, limit = 20, search, paymentMethod } = filters;

  // Validasi akses
  const hasAccess = await prisma.store.findFirst({
    where: { id: storeId, OR: [{ userId }, { members: { some: { userId } } }] },
  });
  if (!hasAccess) {
    throw new Error("Toko tidak ditemukan atau Anda tidak memiliki akses.");
  }

  const where = {
    storeId,
    status: "COMPLETED",
    ...(paymentMethod && { paymentMethod }),
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: transactions,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Mengambil detail satu transaksi.
 * @param {string} transactionId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const getHistoryById = async (transactionId, userId) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      store: { select: { id: true, name: true, address: true, phone: true } },
      user: { select: { id: true, name: true } },
      customer: true,
      items: {
        include: {
          product: { select: { id: true, name: true, code: true } },
          variant: { include: { unit: true } },
        },
      },
    },
  });

  if (!transaction) {
    throw new Error("Transaksi tidak ditemukan.");
  }

  // Validasi akses
  const hasAccess = await prisma.store.findFirst({
    where: {
      id: transaction.storeId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
  });
  if (!hasAccess) {
    throw new Error("Anda tidak memiliki akses ke transaksi ini.");
  }

  return transaction;
};
