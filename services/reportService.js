import prisma from "../config/prisma.js";
import ExcelJS from "exceljs";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import { id } from "date-fns/locale";

// Generate laporan penjualan berdasarkan periode
export const getSalesReport = async (
  storeId,
  userId,
  period = "1",
  startDate,
  endDate
) => {
  // Validasi akses toko
  const store = await validateStoreAccess(storeId, userId);

  let dateRange = {};

  // Tentukan range tanggal berdasarkan periode
  if (startDate && endDate) {
    // Custom date range
    dateRange = {
      gte: startOfDay(new Date(startDate)),
      lte: endOfDay(new Date(endDate)),
    };
  } else {
    // Predefined periods
    const now = new Date();
    switch (period) {
      case "1": // 1 bulan
        dateRange = {
          gte: startOfMonth(subMonths(now, 1)),
          lte: endOfMonth(subMonths(now, 1)),
        };
        break;
      case "6": // 6 bulan
        dateRange = {
          gte: startOfMonth(subMonths(now, 6)),
          lte: endOfMonth(subMonths(now, 1)),
        };
        break;
      case "12": // 12 bulan
        dateRange = {
          gte: startOfMonth(subMonths(now, 12)),
          lte: endOfMonth(subMonths(now, 1)),
        };
        break;
      default: // Real-time (bulan ini)
        dateRange = {
          gte: startOfMonth(now),
          lte: now,
        };
    }
  }

  // Query transaksi dengan filter
  const transactions = await prisma.transaction.findMany({
    where: {
      storeId,
      status: "COMPLETED",
      type: "SALE",
      createdAt: dateRange,
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              code: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
          variant: {
            select: {
              name: true,
              unit: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Hitung ringkasan
  const summary = await calculateSalesSummary(transactions);

  // Group transaksi per hari untuk grafik
  const dailyData = groupTransactionsByDay(transactions);

  // Top selling products
  const topProducts = getTopSellingProducts(transactions);

  return {
    period,
    dateRange: {
      start: format(dateRange.gte, "yyyy-MM-dd", { locale: id }),
      end: format(dateRange.lte || new Date(), "yyyy-MM-dd", { locale: id }),
    },
    store: {
      id: store.id,
      name: store.name,
    },
    summary,
    transactions: transactions.map(formatTransactionForReport),
    dailyData,
    topProducts,
  };
};

// Generate laporan stok produk
export const getStockReport = async (storeId, userId, categoryId = null) => {
  // Validasi akses toko
  const store = await validateStoreAccess(storeId, userId);

  const whereCondition = {
    storeId,
    isActive: true,
  };

  if (categoryId) {
    whereCondition.categoryId = categoryId;
  }

  const products = await prisma.product.findMany({
    where: whereCondition,
    include: {
      category: {
        select: {
          name: true,
        },
      },
      variants: {
        where: {
          isActive: true,
        },
        include: {
          unit: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  // Hitung stok dan nilai inventory
  const stockData = products.map((product) => {
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      unit: variant.unit.name,
      quantity: variant.quantity,
      price: variant.price,
      capitalPrice: variant.capitalPrice,
      stockValue: variant.quantity * variant.capitalPrice,
    }));

    const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);
    const totalStockValue = variants.reduce((sum, v) => sum + v.stockValue, 0);

    return {
      id: product.id,
      name: product.name,
      code: product.code,
      category: product.category?.name || "Tanpa Kategori",
      variants,
      totalQuantity,
      totalStockValue,
      isLowStock: variants.some((v) => v.quantity <= 10), // Threshold bisa dikonfigurasi
    };
  });

  const summary = {
    totalProducts: products.length,
    totalVariants: stockData.reduce((sum, p) => sum + p.variants.length, 0),
    totalStockValue: stockData.reduce((sum, p) => sum + p.totalStockValue, 0),
    lowStockItems: stockData.filter((p) => p.isLowStock).length,
  };

  return {
    store: {
      id: store.id,
      name: store.name,
    },
    summary,
    products: stockData,
    generatedAt: new Date(),
  };
};

// Helper functions
const validateStoreAccess = async (storeId, userId) => {
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
  });

  if (!store) {
    throw new Error("Store not found or you don't have access to this store");
  }

  return store;
};

const calculateSalesSummary = (transactions) => {
  const summary = {
    totalTransactions: transactions.length,
    totalRevenue: 0,
    totalProfit: 0,
    totalTax: 0,
    totalDiscount: 0,
    averageTransaction: 0,
    totalItems: 0,
  };

  transactions.forEach((transaction) => {
    summary.totalRevenue += Number(transaction.total);
    summary.totalTax += Number(transaction.tax);
    summary.totalDiscount += Number(transaction.discount);

    transaction.items.forEach((item) => {
      summary.totalItems += item.quantity;
      // Hitung profit (asumsi ada capital price di variant)
      const capitalPrice = item.variant?.capitalPrice || 0;
      const profit =
        (Number(item.price) - Number(capitalPrice)) * item.quantity;
      summary.totalProfit += profit;
    });
  });

  summary.averageTransaction =
    transactions.length > 0 ? summary.totalRevenue / transactions.length : 0;

  return summary;
};

const groupTransactionsByDay = (transactions) => {
  const dailyMap = new Map();

  transactions.forEach((transaction) => {
    const day = format(new Date(transaction.createdAt), "yyyy-MM-dd");

    if (!dailyMap.has(day)) {
      dailyMap.set(day, {
        date: day,
        revenue: 0,
        transactions: 0,
        items: 0,
      });
    }

    const dayData = dailyMap.get(day);
    dayData.revenue += Number(transaction.total);
    dayData.transactions += 1;
    dayData.items += transaction.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  });

  return Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
};

const getTopSellingProducts = (transactions, limit = 10) => {
  const productMap = new Map();

  transactions.forEach((transaction) => {
    transaction.items.forEach((item) => {
      const key = `${item.productId}-${item.variantId || "default"}`;

      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          productName: item.product.name,
          category: item.product.category?.name || "Tanpa Kategori",
          unit: item.variant?.unit?.name || "-",
          totalQuantity: 0,
          totalRevenue: 0,
          transactions: 0,
        });
      }

      const product = productMap.get(key);
      product.totalQuantity += item.quantity;
      product.totalRevenue += Number(item.subtotal);
      product.transactions += 1;
    });
  });

  return Array.from(productMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
};

const formatTransactionForReport = (transaction) => ({
  id: transaction.id,
  invoiceNumber: transaction.invoiceNumber,
  date: format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", {
    locale: id,
  }),
  customer: transaction.customer?.name || "Walk-in Customer",
  items: transaction.items.length,
  subtotal: Number(transaction.subtotal),
  tax: Number(transaction.tax),
  discount: Number(transaction.discount),
  total: Number(transaction.total),
  paymentMethod: transaction.paymentMethod || "-",
  details: transaction.items.map((item) => ({
    product: item.product.name,
    variant: item.variant?.name || "Default",
    quantity: item.quantity,
    price: Number(item.price),
    subtotal: Number(item.subtotal),
  })),
});

// Generate Excel report
export const generateExcelReport = async (reportData, reportType = "sales") => {
  const workbook = new ExcelJS.Workbook();

  if (reportType === "sales") {
    await createSalesExcelSheet(workbook, reportData);
  } else if (reportType === "stock") {
    await createStockExcelSheet(workbook, reportData);
  }

  // Return buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const createSalesExcelSheet = async (workbook, data) => {
  const worksheet = workbook.addWorksheet("Laporan Penjualan");

  // Header info
  worksheet.addRow(["LAPORAN PENJUALAN"]);
  worksheet.addRow([`Toko: ${data.store.name}`]);
  worksheet.addRow([
    `Periode: ${data.dateRange.start} s/d ${data.dateRange.end}`,
  ]);
  worksheet.addRow([
    `Tanggal Generate: ${format(new Date(), "dd/MM/yyyy HH:mm", {
      locale: id,
    })}`,
  ]);
  worksheet.addRow([]);

  // Summary
  worksheet.addRow(["RINGKASAN"]);
  worksheet.addRow(["Total Transaksi", data.summary.totalTransactions]);
  worksheet.addRow(["Total Pendapatan", data.summary.totalRevenue]);
  worksheet.addRow(["Total Item Terjual", data.summary.totalItems]);
  worksheet.addRow([
    "Rata-rata per Transaksi",
    data.summary.averageTransaction,
  ]);
  worksheet.addRow([]);

  // Transaction details header
  worksheet.addRow([
    "No Invoice",
    "Tanggal",
    "Customer",
    "Item",
    "Subtotal",
    "Pajak",
    "Diskon",
    "Total",
    "Pembayaran",
  ]);

  // Transaction data
  data.transactions.forEach((transaction) => {
    worksheet.addRow([
      transaction.invoiceNumber,
      transaction.date,
      transaction.customer,
      transaction.items,
      transaction.subtotal,
      transaction.tax,
      transaction.discount,
      transaction.total,
      transaction.paymentMethod,
    ]);
  });

  // Styling
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(6).font = { bold: true, size: 14 };

  const headerRow = worksheet.getRow(
    worksheet.rowCount - data.transactions.length
  );
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 15;
  });
};

const createStockExcelSheet = async (workbook, data) => {
  const worksheet = workbook.addWorksheet("Laporan Stok");

  // Header info
  worksheet.addRow(["LAPORAN STOK PRODUK"]);
  worksheet.addRow([`Toko: ${data.store.name}`]);
  worksheet.addRow([
    `Tanggal Generate: ${format(new Date(), "dd/MM/yyyy HH:mm", {
      locale: id,
    })}`,
  ]);
  worksheet.addRow([]);

  // Summary
  worksheet.addRow(["RINGKASAN"]);
  worksheet.addRow(["Total Produk", data.summary.totalProducts]);
  worksheet.addRow(["Total Varian", data.summary.totalVariants]);
  worksheet.addRow(["Nilai Stok Total", data.summary.totalStockValue]);
  worksheet.addRow(["Produk Stok Menipis", data.summary.lowStockItems]);
  worksheet.addRow([]);

  // Stock details header
  worksheet.addRow([
    "Kode Produk",
    "Nama Produk",
    "Kategori",
    "Varian",
    "Unit",
    "Stok",
    "Harga Modal",
    "Harga Jual",
    "Nilai Stok",
    "Status",
  ]);

  // Stock data
  data.products.forEach((product) => {
    if (product.variants.length > 0) {
      product.variants.forEach((variant, index) => {
        worksheet.addRow([
          index === 0 ? product.code || "-" : "",
          index === 0 ? product.name : "",
          index === 0 ? product.category : "",
          variant.name,
          variant.unit,
          variant.quantity,
          variant.capitalPrice,
          variant.price,
          variant.stockValue,
          variant.quantity <= 10 ? "Stok Menipis" : "Normal",
        ]);
      });
    } else {
      worksheet.addRow([
        product.code || "-",
        product.name,
        product.category,
        "-",
        "-",
        0,
        0,
        0,
        0,
        "Tidak ada varian",
      ]);
    }
  });

  // Styling
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(5).font = { bold: true, size: 14 };

  const headerRow = worksheet.getRow(10);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 15;
  });
};
