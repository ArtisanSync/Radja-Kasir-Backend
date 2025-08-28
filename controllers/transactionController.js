import { successResponse, errorResponse } from "../utils/response.js";
import {
  createTransaction as createTransactionService,
  getHistoryAll as getHistoryAllService,
  getHistoryById as getHistoryByIdService,
} from "../services/transactionService.js";

export const createTransaction = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const transaction = await createTransactionService(
      req.body,
      storeId,
      userId
    );
    return successResponse(res, transaction, "Transaksi berhasil dibuat", 201);
  } catch (error) {
    console.error("Create Transaction Error:", error);
    return errorResponse(res, error.message, 400);
  }
};

export const getAllHistory = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const result = await getHistoryAllService(storeId, userId, req.query);
    return successResponse(res, result, "Riwayat transaksi berhasil diambil");
  } catch (error) {
    console.error("Get All History Error:", error);
    return errorResponse(res, error.message, 400);
  }
};

export const getHistoryDetail = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;
    const transaction = await getHistoryByIdService(transactionId, userId);
    return successResponse(
      res,
      transaction,
      "Detail transaksi berhasil diambil"
    );
  } catch (error) {
    console.error("Get History Detail Error:", error);
    return errorResponse(res, error.message, 404);
  }
};
