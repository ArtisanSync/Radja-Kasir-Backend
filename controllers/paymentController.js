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

    console.log(`💳 User ${userId} creating payment for package ${packageId}`);

    const result = await createSubscriptionPayment(userId, packageId);
    
    return successResponse(
      res, 
      result, 
      result.isExisting 
        ? "Existing pending payment found. Please complete the payment."
        : "Payment created successfully. Please complete payment within 24 hours.",
      result.isExisting ? 200 : 201
    );
  } catch (error) {
    console.error("❌ Create payment error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};

// Handle Duitku callback with comprehensive logging
export const paymentCallback = async (req, res) => {
  const requestId = `REQ_${Date.now()}`;
  
  console.log(`\n🔔 === PAYMENT CALLBACK ${requestId} ===`);
  console.log("📋 Request Info:", {
    method: req.method,
    url: req.originalUrl,
    contentType: req.get('Content-Type'),
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
  
  try {
    // Validate request body
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error("❌ Empty request body");
      return res.status(400).json({
        error: "Request body is required",
        received: {
          headers: req.headers,
          method: req.method,
          body: req.body
        }
      });
    }

    console.log("📥 Callback Data:", JSON.stringify(req.body, null, 2));

    // Validate required fields
    const requiredFields = ['merchantCode', 'amount', 'merchantOrderId', 'resultCode'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: Object.keys(req.body),
        required: requiredFields
      });
    }

    // Process the callback
    const result = await handlePaymentCallback(req.body);
    
    console.log("✅ Callback processed successfully:", {
      requestId,
      merchantOrderId: result.merchantOrderId,
      status: result.status,
      userId: result.userId,
      message: result.message
    });
    
    console.log(`🔔 === CALLBACK ${requestId} COMPLETE ===\n`);
    
    // Duitku expects simple OK response
    return res.status(200).send("OK");
    
  } catch (error) {
    console.error(`❌ Callback ${requestId} failed:`, {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      body: req.body
    });
    
    console.log(`🔔 === CALLBACK ${requestId} FAILED ===\n`);
    
    // Return error but still with 200 status to prevent Duitku retries
    return res.status(200).send(`ERROR: ${error.message}`);
  }
};

// Check payment status
export const checkPaymentStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    
    if (!merchantOrderId) {
      return errorResponse(res, "Merchant Order ID is required", 400);
    }

    console.log(`🔍 Status check requested: ${merchantOrderId}`);

    const payment = await getPaymentStatus(merchantOrderId);
    
    return successResponse(
      res, 
      payment, 
      "Payment status retrieved successfully"
    );
  } catch (error) {
    console.error("❌ Status check error:", error.message);
    return errorResponse(res, error.message, error.message.includes("not found") ? 404 : 400);
  }
};

// Get payment history with filtering
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1) {
      return errorResponse(res, "Page and limit must be positive numbers", 400);
    }

    if (limitNum > 50) {
      return errorResponse(res, "Limit cannot exceed 50", 400);
    }

    const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, 400);
    }

    console.log(`📋 Payment history request: User ${userId}, Page ${pageNum}, Status: ${status || 'ALL'}`);

    const result = await getUserPaymentHistory(userId, pageNum, limitNum, status);
    
    return successResponse(
      res, 
      result, 
      "Payment history retrieved successfully"
    );
  } catch (error) {
    console.error("❌ Payment history error:", error.message);
    return errorResponse(res, error.message, 400);
  }
};
  