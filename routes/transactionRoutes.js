import express from "express";
import {
  createTransaction,
  getAllHistory,
  getHistoryDetail,
} from "../controllers/transactionController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/stores/:storeId/transactions", createTransaction);
router.get("/stores/:storeId/transactions", getAllHistory);
router.get("/transactions/:transactionId", getHistoryDetail);

export default router;
