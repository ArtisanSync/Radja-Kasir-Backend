import express from "express";
import {
  getSalesReportController,
  getStockReportController,
  downloadSalesReportController,
  downloadStockReportController,
  getDashboardSummaryController,
  getComparisonReportController,
  getProfitReportController,
  getMarginReportController,
} from "../controllers/reportController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { requireSubscription } from "../middlewares/subscriptionMiddleware.js";

const router = express.Router();

// Authentication required for all routes
router.use(authenticateToken);
router.use(requireSubscription);

router.get("/:storeId/sales", getSalesReportController);
router.get("/:storeId/stock", getStockReportController);
router.get("/:storeId/dashboard", getDashboardSummaryController);
router.get("/:storeId/comparison", getComparisonReportController);
router.get("/:storeId/profit", getProfitReportController);
router.get("/:storeId/margin", getMarginReportController);
router.get("/:storeId/sales/download", downloadSalesReportController);
router.get("/:storeId/stock/download", downloadStockReportController);

export default router;
