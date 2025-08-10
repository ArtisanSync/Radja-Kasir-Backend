import { successResponse, errorResponse } from "../utils/response.js";
import {
  getSalesReport,
  getStockReport,
  generateExcelReport,
} from "../services/reportService.js";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Controller untuk mendapatkan laporan penjualan
export const getSalesReportController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = "realtime", startDate, endDate } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    // Validasi format tanggal jika ada custom range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse(res, "Invalid date format. Use YYYY-MM-DD", 400);
      }

      if (start > end) {
        return errorResponse(
          res,
          "Start date cannot be later than end date",
          400
        );
      }

      // Validasi maksimal range 1 tahun
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 tahun dalam milliseconds
      if (end - start > oneYearInMs) {
        return errorResponse(
          res,
          "Date range cannot exceed 1 year (365 days)",
          400
        );
      }
    }

    const reportData = await getSalesReport(
      storeId,
      userId,
      period,
      startDate,
      endDate
    );

    return successResponse(
      res,
      reportData,
      "Sales report retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Controller untuk mendapatkan laporan stok
export const getStockReportController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { categoryId } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const reportData = await getStockReport(storeId, userId, categoryId);

    return successResponse(
      res,
      reportData,
      "Stock report retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Controller untuk download laporan penjualan dalam format Excel
export const downloadSalesReportController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = "realtime", startDate, endDate } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    // Validasi format tanggal jika ada custom range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse(res, "Invalid date format. Use YYYY-MM-DD", 400);
      }

      // Validasi maksimal range 1 tahun
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 tahun dalam milliseconds
      if (end - start > oneYearInMs) {
        return errorResponse(
          res,
          "Date range cannot exceed 1 year (365 days)",
          400
        );
      }
    }

    const reportData = await getSalesReport(
      storeId,
      userId,
      period,
      startDate,
      endDate
    );
    const excelBuffer = await generateExcelReport(reportData, "sales");

    // Generate filename dengan timestamp
    const timestamp = format(new Date(), "yyyyMMdd_HHmmss", { locale: id });
    const filename = `Laporan_Penjualan_${reportData.store.name}_${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

    return res.send(excelBuffer);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Controller untuk download laporan stok dalam format Excel
export const downloadStockReportController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { categoryId } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    const reportData = await getStockReport(storeId, userId, categoryId);
    const excelBuffer = await generateExcelReport(reportData, "stock");

    // Generate filename dengan timestamp
    const timestamp = format(new Date(), "yyyyMMdd_HHmmss", { locale: id });
    const filename = `Laporan_Stok_${reportData.store.name}_${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);

    return res.send(excelBuffer);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Controller untuk mendapatkan ringkasan dashboard
export const getDashboardSummaryController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    // Ambil laporan real-time (bulan ini) dan laporan bulan lalu untuk comparison
    const [currentMonth, lastMonth] = await Promise.all([
      getSalesReport(storeId, userId, "realtime"),
      getSalesReport(storeId, userId, "1"),
    ]);

    // Hitung persentase perubahan
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const summary = {
      currentPeriod: {
        revenue: currentMonth.summary.totalRevenue,
        transactions: currentMonth.summary.totalTransactions,
        items: currentMonth.summary.totalItems,
        averageTransaction: currentMonth.summary.averageTransaction,
      },
      previousPeriod: {
        revenue: lastMonth.summary.totalRevenue,
        transactions: lastMonth.summary.totalTransactions,
        items: lastMonth.summary.totalItems,
        averageTransaction: lastMonth.summary.averageTransaction,
      },
      growth: {
        revenue: calculateGrowth(
          currentMonth.summary.totalRevenue,
          lastMonth.summary.totalRevenue
        ),
        transactions: calculateGrowth(
          currentMonth.summary.totalTransactions,
          lastMonth.summary.totalTransactions
        ),
        items: calculateGrowth(
          currentMonth.summary.totalItems,
          lastMonth.summary.totalItems
        ),
        averageTransaction: calculateGrowth(
          currentMonth.summary.averageTransaction,
          lastMonth.summary.averageTransaction
        ),
      },
      topProducts: currentMonth.topProducts.slice(0, 5), // Top 5 untuk dashboard
      dailyData: currentMonth.dailyData.slice(-7), // 7 hari terakhir
    };

    return successResponse(
      res,
      summary,
      "Dashboard summary retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Controller untuk mendapatkan laporan perbandingan periode
export const getComparisonReportController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { currentStart, currentEnd, previousStart, previousEnd } = req.query;
    const userId = req.user.id;

    if (!storeId) {
      return errorResponse(res, "Store ID is required", 400);
    }

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return errorResponse(
        res,
        "All date parameters are required for comparison",
        400
      );
    }

    // Validasi format tanggal
    const dates = [currentStart, currentEnd, previousStart, previousEnd].map(
      (d) => new Date(d)
    );
    if (dates.some((d) => isNaN(d.getTime()))) {
      return errorResponse(res, "Invalid date format. Use YYYY-MM-DD", 400);
    }

    // Validasi maksimal range 1 tahun untuk setiap periode
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    const currentRange = dates[1] - dates[0]; // currentEnd - currentStart
    const previousRange = dates[3] - dates[2]; // previousEnd - previousStart

    if (currentRange > oneYearInMs || previousRange > oneYearInMs) {
      return errorResponse(
        res,
        "Each comparison period cannot exceed 1 year (365 days)",
        400
      );
    }

    const [currentPeriod, previousPeriod] = await Promise.all([
      getSalesReport(storeId, userId, "custom", currentStart, currentEnd),
      getSalesReport(storeId, userId, "custom", previousStart, previousEnd),
    ]);

    // Hitung persentase perubahan
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const comparison = {
      current: {
        period: currentPeriod.dateRange,
        summary: currentPeriod.summary,
        topProducts: currentPeriod.topProducts.slice(0, 10),
      },
      previous: {
        period: previousPeriod.dateRange,
        summary: previousPeriod.summary,
        topProducts: previousPeriod.topProducts.slice(0, 10),
      },
      changes: {
        revenue: calculateChange(
          currentPeriod.summary.totalRevenue,
          previousPeriod.summary.totalRevenue
        ),
        transactions: calculateChange(
          currentPeriod.summary.totalTransactions,
          previousPeriod.summary.totalTransactions
        ),
        items: calculateChange(
          currentPeriod.summary.totalItems,
          previousPeriod.summary.totalItems
        ),
        averageTransaction: calculateChange(
          currentPeriod.summary.averageTransaction,
          previousPeriod.summary.averageTransaction
        ),
      },
    };

    return successResponse(
      res,
      comparison,
      "Comparison report retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};
