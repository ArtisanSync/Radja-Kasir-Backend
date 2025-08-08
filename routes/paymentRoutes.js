import express from "express";
import {
  createPayment,
  paymentCallback,
  checkPaymentStatus,
  getPaymentHistory,
} from "../controllers/paymentController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { createNewUserSubscription } from "../services/subscriptionService.js";
import { successResponse, errorResponse } from "../utils/response.js";
import prisma from "../config/prisma.js";

const router = express.Router();

// Public callback endpoint untuk Duitku (tidak butuh auth)
router.post("/callback", paymentCallback);

// Protected routes (butuh authentication)
router.post("/create", authenticateToken, createPayment);
router.get("/status/:merchantOrderId", authenticateToken, checkPaymentStatus);
router.get("/history", authenticateToken, getPaymentHistory);

// Development endpoints
if (process.env.NODE_ENV === 'development') {
  console.log("🚀 Development payment endpoints enabled");
  
  // Direct subscription activation untuk testing
  router.post('/dev/activate-subscription', authenticateToken, async (req, res) => {
    try {
      const { packageId } = req.body;
      const userId = req.user.id;
      
      if (!packageId) {
        return errorResponse(res, "Package ID is required", 400);
      }
      
      // Get package info
      const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
        where: { id: packageId },
      });

      if (!subscriptionPackage) {
        return errorResponse(res, "Package not found", 404);
      }
      
      // Create subscription directly (bypass payment)
      const subscription = await createNewUserSubscription(userId, packageId);
      
      console.log(`🚀 DEV MODE: Subscription activated for user ${userId}`);
      
      return successResponse(res, {
        subscription,
        message: "Subscription activated successfully (Development Mode)",
        devMode: true,
        package: subscriptionPackage
      }, "Subscription activated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  });

  // Manual callback testing
  router.post('/dev/test-callback', async (req, res) => {
    try {
      const { merchantOrderId, resultCode = "00" } = req.body;
      
      if (!merchantOrderId) {
        return errorResponse(res, "merchantOrderId is required", 400);
      }

      const payment = await prisma.payment.findUnique({
        where: { merchantOrderId },
      });

      if (!payment) {
        return errorResponse(res, "Payment not found", 404);
      }

      // Simulate callback
      const callbackData = {
        merchantCode: "DS24351",
        amount: payment.paymentAmount.toString(),
        merchantOrderId,
        productDetail: payment.productDetail,
        resultCode,
        signature: "test_signature_dev_mode"
      };

      // Process callback
      const { handlePaymentCallback } = await import("../services/paymentService.js");
      const result = await handlePaymentCallback(callbackData);

      return successResponse(res, {
        result,
        callbackData,
        message: "Callback processed successfully (Development Mode)",
        devMode: true
      }, "Callback processed");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  });
}

export default router;
