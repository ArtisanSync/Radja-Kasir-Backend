import prisma from "../config/prisma.js";
import duitku from "../config/duitku.js";
import { createNewUserSubscription } from "./subscriptionService.js";

// Create subscription payment with enhanced error handling
export const createSubscriptionPayment = async (userId, packageId) => {
  console.log("\n💰 === CREATING SUBSCRIPTION PAYMENT ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`📦 Package ID: ${packageId}`);

  try {
    // Get user data with correct field names
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true, // Using emailVerifiedAt instead of isEmailVerified
        createdAt: true
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.emailVerifiedAt) {
      throw new Error("Email must be verified before making payment. Please check your email and verify your account first.");
    }

    if (!user.isActive) {
      throw new Error("Account is not active. Please contact support.");
    }

    // Get subscription package
    const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId, isActive: true },
    });

    if (!subscriptionPackage) {
      throw new Error("Subscription package not found or inactive");
    }

    console.log(`📋 User: ${user.name} (${user.email})`);
    console.log(`✅ Email verified: ${user.emailVerifiedAt ? 'YES' : 'NO'}`);
    console.log(`📦 Package: ${subscriptionPackage.displayName} - Rp ${subscriptionPackage.price.toLocaleString('id-ID')}`);

    // Check for existing pending payments
    const existingPendingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: "PENDING",
        expiredAt: { gte: new Date() },
        // Check by productDetail since no packageId field
        productDetail: { contains: subscriptionPackage.displayName }
      },
      orderBy: { createdAt: "desc" }
    });

    if (existingPendingPayment) {
      console.log("⚠️ Found existing pending payment, returning existing payment URL");
      
      return {
        payment: existingPendingPayment,
        paymentUrl: existingPendingPayment.paymentUrl,
        package: subscriptionPackage,
        expiresAt: existingPendingPayment.expiredAt,
        isExisting: true,
        message: "You have an existing pending payment. Please complete the payment or wait for expiration to create a new one."
      };
    }

    // Generate unique merchant order ID
    const timestamp = Date.now();
    const userIdSuffix = userId.slice(-8).toUpperCase();
    const merchantOrderId = `SUB_${timestamp}_${userIdSuffix}`;

    console.log(`🆔 Generated Order ID: ${merchantOrderId}`);

    // Calculate expiry (24 hours from now)
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create payment record WITHOUT packageId field (since it doesn't exist in schema)
    const payment = await prisma.payment.create({
      data: {
        userId,
        // packageId field doesn't exist in schema, so we store package info in productDetail
        merchantCode: duitku.merchantCode,
        reference: `REF_${timestamp}_${userIdSuffix}`,
        merchantOrderId,
        paymentAmount: subscriptionPackage.price,
        // Store package info as JSON in productDetail
        productDetail: JSON.stringify({
          type: "subscription",
          packageId: packageId,
          packageName: subscriptionPackage.name,
          displayName: subscriptionPackage.displayName,
          description: `Subscription ${subscriptionPackage.displayName}`
        }),
        status: "PENDING",
        expiryPeriod: 1440,
        expiredAt,
        callbackUrl: duitku.callbackUrl,
        returnUrl: duitku.returnUrl,
      },
    });

    console.log(`💾 Payment record created: ${payment.id}`);

    // Create Duitku payment
    const duitkuPayment = await duitku.createPayment({
      merchantOrderId,
      paymentAmount: subscriptionPackage.price,
      productDetail: `Subscription ${subscriptionPackage.displayName}`,
      email: user.email,
      phoneNumber: user.phone || "081234567890",
      customerName: user.name,
      expiryPeriod: 1440,
    });

    // Handle Duitku response
    if (!duitkuPayment.success) {
      console.error("❌ Duitku payment creation failed:", duitkuPayment.error);
      
      // Update payment status to failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: "FAILED",
          statusMessage: JSON.stringify(duitkuPayment.error)
        },
      });
      
      throw new Error(`Payment gateway error: ${JSON.stringify(duitkuPayment.error)}`);
    }

    // Update payment with Duitku response data
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        reference: duitkuPayment.data.reference || payment.reference,
        paymentUrl: duitkuPayment.data.paymentUrl,
        paymentMethod: duitkuPayment.data.paymentMethod || "Credit Card",
        signature: duitkuPayment.data.signature,
        statusMessage: "Payment URL generated successfully"
      },
    });

    console.log("✅ Payment creation completed successfully");
    console.log("=========================================\n");

    return {
      payment: updatedPayment,
      paymentUrl: duitkuPayment.data.paymentUrl,
      paymentDetails: {
        reference: duitkuPayment.data.reference,
        amount: subscriptionPackage.price,
        currency: "IDR",
        expiryHours: 24,
        merchantOrderId: updatedPayment.merchantOrderId
      },
      package: subscriptionPackage,
      expiresAt: payment.expiredAt,
      instructions: {
        sandbox: process.env.NODE_ENV !== 'production',
        message: process.env.NODE_ENV !== 'production' 
          ? "This is sandbox payment. Use test credit cards or force success in development endpoints."
          : "Complete your payment within 24 hours to activate your subscription.",
        steps: [
          "1. Click on the payment URL to proceed",
          "2. Fill in your payment details",
          "3. Complete the payment process", 
          "4. Wait for confirmation",
          "5. Your subscription will be activated automatically"
        ],
        testCards: process.env.NODE_ENV !== 'production' ? [
          "Visa: 4811111111111114 (12/25, CVV: 123)",
          "Mastercard: 5555555555554444 (12/25, CVV: 123)",
          "For testing: Use any valid future expiry date"
        ] : undefined
      }
    };

  } catch (error) {
    console.error("❌ Payment creation failed:", error.message);
    console.log("=========================================\n");
    throw error;
  }
};

// Enhanced callback handler with better error handling
export const handlePaymentCallback = async (callbackData) => {
  console.log("\n🔔 === PAYMENT CALLBACK PROCESSING ===");
  console.log("📥 Received callback data:", JSON.stringify(callbackData, null, 2));

  try {
    // Validate callback structure
    if (!callbackData || typeof callbackData !== 'object') {
      throw new Error("Invalid callback data format");
    }

    // Extract and validate required fields
    const {
      merchantCode,
      amount,
      merchantOrderId,
      productDetail,
      resultCode,
      signature,
      reference
    } = callbackData;

    const requiredFields = { merchantCode, amount, merchantOrderId, resultCode };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      throw new Error(`Missing required callback fields: ${missingFields.join(", ")}`);
    }

    console.log("📋 Callback Summary:", {
      merchantCode,
      merchantOrderId,
      amount: `Rp ${parseInt(amount).toLocaleString('id-ID')}`,
      resultCode,
      status: resultCode === "00" ? "SUCCESS" : "FAILED",
      reference,
      hasSignature: !!signature
    });

    // Verify signature (with sandbox tolerance)
    const isSignatureValid = duitku.verifyCallback(merchantCode, amount, merchantOrderId, signature);
    
    if (!isSignatureValid && process.env.NODE_ENV === 'production') {
      throw new Error("Invalid signature - callback rejected");
    }

    if (!isSignatureValid) {
      console.log("⚠️ Signature verification failed - proceeding in development mode");
    } else {
      console.log("✅ Signature verification passed");
    }

    // Find payment record (without package relation since it doesn't exist)
    const payment = await prisma.payment.findUnique({
      where: { merchantOrderId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
        // No package relation exists in schema
      },
    });

    if (!payment) {
      throw new Error(`Payment record not found: ${merchantOrderId}`);
    }

    console.log(`📦 Payment found: ${payment.id} for user ${payment.user.name}`);

    // Extract package info from productDetail JSON
    let packageInfo = null;
    try {
      packageInfo = JSON.parse(payment.productDetail);
    } catch (e) {
      console.log("⚠️ Could not parse productDetail as JSON, using fallback");
      packageInfo = { displayName: "Unknown Package" };
    }

    // Check if already processed
    if (payment.status !== "PENDING") {
      console.log(`⚠️ Payment already processed with status: ${payment.status}`);
      return {
        merchantOrderId,
        status: payment.status,
        message: "Payment already processed",
        userId: payment.userId
      };
    }

    // Determine payment success
    const isSuccess = resultCode === "00";
    const newStatus = isSuccess ? "SUCCESS" : "FAILED";
    const statusMessage = isSuccess 
      ? "Payment completed successfully"
      : `Payment failed with code: ${resultCode}`;

    console.log(`📊 Processing result: ${resultCode} → ${newStatus}`);

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        statusMessage,
        paidAt: isSuccess ? new Date() : null,
        reference: reference || payment.reference,
      },
    });

    console.log(`💾 Payment updated: ${merchantOrderId} → ${newStatus}`);

    // Create subscription if payment successful
    if (isSuccess) {
      console.log("🚀 Payment successful - Creating subscription...");

      try {
        // Get packageId from productDetail JSON
        const packageId = packageInfo?.packageId;
        if (!packageId) {
          throw new Error("Package ID not found in payment details");
        }

        const subscriptionResult = await createNewUserSubscription(
          payment.userId, 
          packageId
        );

        // Link payment to subscription
        await prisma.payment.update({
          where: { id: payment.id },
          data: { subscriptionId: subscriptionResult.subscription.id },
        });

        console.log(`✅ Subscription created: ${subscriptionResult.subscription.id}`);
        
        // Log success summary
        const isNewUser = subscriptionResult.promotion?.isNewUser || false;
        console.log("\n🎉 === SUBSCRIPTION ACTIVATION SUCCESS ===");
        console.log(`👤 User: ${payment.user.name} (${payment.user.email})`);
        console.log(`📦 Package: ${packageInfo?.displayName || 'Unknown'}`);
        console.log(`💰 Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}`);
        console.log(`🎁 New User Promo: ${isNewUser ? "YES (2 months access)" : "NO (1 month access)"}`);
        console.log(`📅 Valid Until: ${subscriptionResult.subscription.endDate.toLocaleDateString('id-ID')}`);
        console.log("============================================");

        return {
          merchantOrderId,
          status: newStatus,
          userId: payment.userId,
          amount: parseInt(amount),
          message: statusMessage,
          subscription: {
            id: subscriptionResult.subscription.id,
            status: subscriptionResult.subscription.status,
            endDate: subscriptionResult.subscription.endDate,
            isNewUserPromo: isNewUser
          }
        };

      } catch (subscriptionError) {
        console.error("❌ Subscription creation failed:", subscriptionError.message);
        
        // Update payment with subscription error
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            statusMessage: `Payment successful but subscription creation failed: ${subscriptionError.message}`
          },
        });
        
        // Don't throw error here - payment was successful
        return {
          merchantOrderId,
          status: newStatus,
          userId: payment.userId,
          amount: parseInt(amount),
          message: `${statusMessage} (Subscription creation failed: ${subscriptionError.message})`
        };
      }
    }

    console.log("✅ Callback processing completed");
    console.log("==================================\n");

    return {
      merchantOrderId,
      status: newStatus,
      userId: payment.userId,
      amount: parseInt(amount),
      message: statusMessage
    };

  } catch (error) {
    console.error("❌ Callback processing failed:", error.message);
    console.log("==================================\n");
    throw error;
  }
};

// Get payment status with enhanced details
export const getPaymentStatus = async (merchantOrderId) => {
  console.log(`🔍 Getting payment status: ${merchantOrderId}`);

  const payment = await prisma.payment.findUnique({
    where: { merchantOrderId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      subscription: {
        include: {
          package: {
            select: { name: true, displayName: true, maxStores: true, maxMembers: true },
          },
        },
      },
      // No package relation exists in schema
    },
  });

  if (!payment) {
    throw new Error(`Payment not found: ${merchantOrderId}`);
  }

  // Extract package info from productDetail
  let packageInfo = null;
  try {
    packageInfo = JSON.parse(payment.productDetail);
  } catch (e) {
    packageInfo = { displayName: "Unknown Package" };
  }

  const now = new Date();
  const isExpired = payment.expiredAt && now > payment.expiredAt;
  const timeRemaining = payment.expiredAt ? Math.max(0, payment.expiredAt - now) : null;

  console.log(`📊 Payment status: ${payment.status}${isExpired ? ' (EXPIRED)' : ''}`);

  return {
    ...payment,
    packageInfo, // Add extracted package info
    isExpired,
    timeRemaining,
    timeRemainingHours: timeRemaining ? Math.ceil(timeRemaining / (1000 * 60 * 60)) : 0,
    formattedAmount: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`,
    statusLabel: getPaymentStatusLabel(payment.status),
  };
};

// Get user payment history with enhanced filtering
export const getUserPaymentHistory = async (userId, page = 1, limit = 10, status = null) => {
  console.log(`📋 Getting payment history: User ${userId}, Page ${page}, Status: ${status || 'ALL'}`);

  const skip = (page - 1) * limit;
  
  const whereClause = { userId };
  if (status) {
    whereClause.status = status;
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      include: {
        subscription: {
          include: {
            package: {
              select: { name: true, displayName: true }
            }
          }
        },
        // No package relation exists in schema
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: whereClause }),
  ]);

  console.log(`📊 Found ${payments.length}/${total} payments`);

  const enrichedPayments = payments.map(payment => {
    const now = new Date();
    const isExpired = payment.expiredAt && now > payment.expiredAt;
    
    // Extract package info from productDetail
    let packageInfo = null;
    try {
      packageInfo = JSON.parse(payment.productDetail);
    } catch (e) {
      packageInfo = { displayName: "Unknown Package" };
    }
    
    return {
      ...payment,
      packageInfo, // Add extracted package info
      isExpired,
      statusLabel: getPaymentStatusLabel(payment.status),
      formattedAmount: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`,
      timeRemainingHours: payment.expiredAt && !isExpired 
        ? Math.ceil((payment.expiredAt - now) / (1000 * 60 * 60)) 
        : 0,
    };
  });

  return {
    payments: enrichedPayments,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
    summary: {
      totalPayments: total,
      pendingCount: await prisma.payment.count({ where: { ...whereClause, status: "PENDING" } }),
      successCount: await prisma.payment.count({ where: { ...whereClause, status: "SUCCESS" } }),
      failedCount: await prisma.payment.count({ where: { ...whereClause, status: "FAILED" } }),
    }
  };
};

// Helper function for status labels
const getPaymentStatusLabel = (status) => {
  const labels = {
    PENDING: "Menunggu Pembayaran",
    SUCCESS: "Pembayaran Berhasil", 
    FAILED: "Pembayaran Gagal",
    EXPIRED: "Kadaluarsa",
  };
  return labels[status] || status;
};

// Cancel expired payments (utility function)
export const cancelExpiredPayments = async () => {
  try {
    console.log("🧹 Checking for expired payments...");
    
    const expiredPayments = await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        expiredAt: { lt: new Date() }
      },
      data: {
        status: "EXPIRED",
        statusMessage: "Payment expired - automatically cancelled"
      }
    });

    if (expiredPayments.count > 0) {
      console.log(`✅ Cancelled ${expiredPayments.count} expired payments`);
    }

    return expiredPayments;
  } catch (error) {
    console.error("❌ Failed to cancel expired payments:", error.message);
    throw error;
  }
};
