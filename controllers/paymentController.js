import { successResponse, errorResponse } from "../utils/response.js";
import {
  createSubscriptionPayment,
  handlePaymentCallback,
  getPaymentStatus,
  getUserPaymentHistory,
} from "../services/paymentService.js";

// Create payment for subscription
export const createPayment = async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    if (!packageId) {
      return errorResponse(res, "Package ID is required", 400);
    }

    console.log(`💳 Creating payment for user: ${userId}, package: ${packageId}`);

    const result = await createSubscriptionPayment(userId, packageId);
    return successResponse(res, result, "Payment created successfully", 201);
  } catch (error) {
    console.error("❌ Create payment error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Handle Duitku callback
export const paymentCallback = async (req, res) => {
  console.log("\n🔔 === PAYMENT CALLBACK RECEIVED ===");
  console.log("📥 Headers:", JSON.stringify(req.headers, null, 2));
  console.log("📥 Method:", req.method);
  console.log("📥 URL:", req.originalUrl);
  console.log("📥 Content-Type:", req.get('Content-Type'));
  
  try {
    if (!req.body) {
      console.error("❌ Request body is missing");
      return res.status(400).json({
        error: "Request body is required",
        received: {
          headers: req.headers,
          method: req.method,
          contentType: req.get('Content-Type')
        }
      });
    }

    console.log("📥 Body:", JSON.stringify(req.body, null, 2));
    const callbackData = req.body;
    const requiredFields = ['merchantCode', 'amount', 'merchantOrderId', 'resultCode'];
    const missingFields = requiredFields.filter(field => !callbackData[field]);
    
    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: callbackData,
        required: requiredFields
      });
    }

    console.log("✅ Callback validation passed");

    // Process payment callback
    const result = await handlePaymentCallback(callbackData);
    
    console.log("✅ Callback processed successfully:", {
      merchantOrderId: result.merchantOrderId,
      status: result.status,
      userId: result.userId
    });
    
    console.log("🔔 === CALLBACK PROCESSING COMPLETE ===\n");
    
    // Duitku expects simple "OK" response
    return res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Payment callback error:", {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      body: req.body
    });
    
    console.log("🔔 === CALLBACK PROCESSING FAILED ===\n");
    return res.status(400).send("ERROR: " + error.message);
  }
};

// Check payment status
export const checkPaymentStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    
    if (!merchantOrderId) {
      return errorResponse(res, "Merchant Order ID is required", 400);
    }

    console.log(`🔍 Checking payment status: ${merchantOrderId}`);

    const payment = await getPaymentStatus(merchantOrderId);
    return successResponse(res, payment, "Payment status retrieved successfully");
  } catch (error) {
    console.error("❌ Check payment status error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Get payment history
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1) {
      return errorResponse(res, "Page and limit must be positive numbers", 400);
    }

    if (limitNum > 100) {
      return errorResponse(res, "Limit cannot exceed 100", 400);
    }

    console.log(`📋 Getting payment history for user: ${userId}, page: ${pageNum}, limit: ${limitNum}`);

    const result = await getUserPaymentHistory(userId, pageNum, limitNum);
    return successResponse(res, result, "Payment history retrieved successfully");
  } catch (error) {
    console.error("❌ Get payment history error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};
