import express from "express";
import {
  createPayment,
  paymentCallback,
  checkPaymentStatus,
  getPaymentHistory,
} from "../controllers/paymentController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { createNewUserSubscription } from "../services/subscriptionService.js";
import { handlePaymentCallback } from "../services/paymentService.js";
import { successResponse, errorResponse } from "../utils/response.js";
import prisma from "../config/prisma.js";
import duitku from "../config/duitku.js";

const router = express.Router();

// Public callback endpoint - No authentication required
router.post("/callback", paymentCallback);

// Protected routes
router.use(authenticateToken);

// Main payment routes
router.post("/create", createPayment);
router.get("/status/:merchantOrderId", checkPaymentStatus);
router.get("/history", getPaymentHistory);

// Development/Testing endpoints
if (process.env.NODE_ENV !== 'production') {
  console.log("🚀 Development payment endpoints enabled");
  
  // Direct subscription activation (bypass payment)
  router.post('/dev/activate-subscription', async (req, res) => {
    try {
      const { packageId } = req.body;
      const userId = req.user.id;
      
      if (!packageId) {
        return errorResponse(res, "Package ID is required", 400);
      }
      
      console.log(`🚀 DEV: Direct subscription activation for user ${userId}`);
      
      const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
        where: { id: packageId },
      });

      if (!subscriptionPackage) {
        return errorResponse(res, "Package not found", 404);
      }
      
      const result = await createNewUserSubscription(userId, packageId);
      
      console.log(`✅ DEV: Subscription activated successfully`);
      
      return successResponse(res, {
        subscription: result.subscription,
        promotion: result.promotion,
        package: subscriptionPackage,
        devMode: true,
        message: "Subscription activated successfully (Development Mode - No Payment Required)"
      }, "Development subscription activated");
      
    } catch (error) {
      console.error("❌ DEV activation error:", error.message);
      return errorResponse(res, error.message, 400);
    }
  });

  // Simulate payment callback
  router.post('/dev/simulate-callback', async (req, res) => {
    try {
      const { merchantOrderId, resultCode = "00" } = req.body;
      
      if (!merchantOrderId) {
        return errorResponse(res, "merchantOrderId is required", 400);
      }

      console.log(`🎭 DEV: Simulating callback for ${merchantOrderId}`);

      const payment = await prisma.payment.findUnique({
        where: { merchantOrderId },
        include: { user: true, package: true }
      });

      if (!payment) {
        return errorResponse(res, "Payment not found", 404);
      }

      if (payment.status !== 'PENDING') {
        return errorResponse(res, `Payment already processed: ${payment.status}`, 400);
      }

      // Create simulated callback data
      const callbackData = {
        merchantCode: duitku.merchantCode,
        amount: payment.paymentAmount.toString(),
        merchantOrderId,
        productDetail: payment.productDetail,
        resultCode,
        reference: payment.reference,
        signature: "dev_simulated_signature"
      };

      console.log("🎭 DEV: Simulated callback data:", callbackData);

      // Process callback
      const result = await handlePaymentCallback(callbackData);

      return successResponse(res, {
        result,
        callbackData,
        originalPayment: {
          id: payment.id,
          user: payment.user.name,
          package: payment.package?.displayName,
          amount: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`
        },
        devMode: true,
        message: "Payment callback simulated successfully"
      }, "Callback simulation completed");
      
    } catch (error) {
      console.error("❌ DEV simulation error:", error.message);
      return errorResponse(res, error.message, 400);
    }
  });

  // Force payment success (simulate completed payment)
  router.post('/dev/force-success', async (req, res) => {
    try {
      const { merchantOrderId } = req.body;
      
      if (!merchantOrderId) {
        return errorResponse(res, "merchantOrderId is required", 400);
      }

      console.log(`🎯 DEV: Force success for ${merchantOrderId}`);

      const payment = await prisma.payment.findUnique({
        where: { merchantOrderId },
        include: { user: true, package: true }
      });

      if (!payment) {
        return errorResponse(res, "Payment not found", 404);
      }

      if (payment.status === 'SUCCESS') {
        return errorResponse(res, "Payment already successful", 400);
      }

      // Update payment to success
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          statusMessage: 'Force success - Development Mode'
        }
      });

      // Create subscription if not exists
      let subscription = null;
      if (!payment.subscriptionId) {
        const subscriptionResult = await createNewUserSubscription(
          payment.userId, 
          payment.packageId || payment.package?.id
        );
        
        subscription = subscriptionResult.subscription;
        
        // Link payment to subscription
        await prisma.payment.update({
          where: { id: payment.id },
          data: { subscriptionId: subscription.id }
        });
      }

      return successResponse(res, {
        payment: updatedPayment,
        subscription,
        user: payment.user.name,
        package: payment.package?.displayName,
        amount: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`,
        devMode: true,
        message: "Payment forced to success - subscription activated"
      }, "Payment success forced");
      
    } catch (error) {
      console.error("❌ DEV force success error:", error.message);
      return errorResponse(res, error.message, 400);
    }
  });

  // Get all payments (admin view for development)
  router.get('/dev/all-payments', async (req, res) => {
    try {
      const payments = await prisma.payment.findMany({
        include: {
          user: { select: { name: true, email: true } },
          package: { select: { displayName: true, price: true } },
          subscription: { select: { id: true, status: true, endDate: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const enrichedPayments = payments.map(payment => ({
        ...payment,
        formattedAmount: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`,
        isExpired: payment.expiredAt ? new Date() > payment.expiredAt : false,
        timeRemaining: payment.expiredAt ? Math.max(0, payment.expiredAt - new Date()) : null
      }));

      return successResponse(res, {
        payments: enrichedPayments,
        count: payments.length,
        devMode: true
      }, "All payments retrieved (Development Mode)");
      
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  });
}

export default router;
