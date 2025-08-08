import prisma from "../config/prisma.js";
import duitku from "../config/duitku.js";

// Create payment for subscription
export const createSubscriptionPayment = async (userId, packageId) => {
  console.log(`💳 Starting payment creation for user: ${userId}`);

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      phone: true,
      whatsapp: true 
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get subscription package
  const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!subscriptionPackage) {
    throw new Error("Subscription package not found");
  }

  console.log(`📦 Package selected: ${subscriptionPackage.displayName} - Rp ${subscriptionPackage.price}`);

  // Generate unique merchant order ID
  const timestamp = Date.now();
  const userIdSuffix = userId.slice(-8);
  const merchantOrderId = `SUB_${timestamp}_${userIdSuffix}`;

  console.log(`🔖 Generated merchantOrderId: ${merchantOrderId}`);

  // Create payment record in database
  const payment = await prisma.payment.create({
    data: {
      userId,
      merchantCode: duitku.merchantCode,
      reference: `REF_${timestamp}`,
      merchantOrderId,
      paymentAmount: subscriptionPackage.price,
      productDetail: `Subscription ${subscriptionPackage.displayName}`,
      status: "PENDING",
      expiryPeriod: 1440, // 24 hours
      expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      callbackUrl: duitku.callbackUrl,
      returnUrl: duitku.returnUrl,
    },
  });

  console.log(`💾 Payment record created: ${payment.id}`);

  // Create Duitku payment request
  const duitkuPayment = await duitku.createPayment({
    merchantOrderId,
    paymentAmount: parseFloat(subscriptionPackage.price),
    productDetail: `Langganan ${subscriptionPackage.displayName}`,
    email: user.email,
    phoneNumber: user.whatsapp || user.phone || "081234567890",
    customerName: user.name,
    expiryPeriod: 1440,
  });

  // Handle Duitku API response
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
    
    throw new Error(`Failed to create payment: ${JSON.stringify(duitkuPayment.error)}`);
  }

  console.log("✅ Duitku payment created successfully");

  // Update payment record with Duitku response
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      reference: duitkuPayment.data.reference || payment.reference,
      paymentUrl: duitkuPayment.data.paymentUrl,
      paymentMethod: duitkuPayment.data.vaNumber ? "Virtual Account" : "Credit Card",
      signature: duitkuPayment.data.signature,
    },
  });

  console.log(`✅ Payment updated with Duitku response: ${updatedPayment.reference}`);

  return {
    payment: updatedPayment,
    paymentUrl: duitkuPayment.data.paymentUrl,
    paymentDetails: duitkuPayment.data,
    package: subscriptionPackage,
    expiresAt: payment.expiredAt,
    instructions: {
      sandbox: process.env.NODE_ENV !== 'production',
      message: process.env.NODE_ENV !== 'production' 
        ? "This is sandbox payment. Use test credit cards or force success in Duitku dashboard."
        : "Complete payment within 24 hours to activate subscription."
    }
  };
};

// Handle payment callback from Duitku
export const handlePaymentCallback = async (callbackData) => {
  console.log("\n🔄 Starting callback processing...");

  // Validate callback data structure
  if (!callbackData || typeof callbackData !== 'object') {
    throw new Error("Invalid callback data format");
  }

  // Extract callback fields with default values
  const {
    merchantCode = null,
    amount = null,
    merchantOrderId = null,
    productDetail = null,
    resultCode = null,
    signature = null,
  } = callbackData;

  console.log("📋 Callback data extracted:", {
    merchantCode,
    amount,
    merchantOrderId,
    resultCode,
    productDetail,
    hasSignature: !!signature
  });

  // Validate required fields
  if (!merchantCode || !amount || !merchantOrderId || !resultCode) {
    throw new Error("Missing required callback fields: merchantCode, amount, merchantOrderId, resultCode");
  }

  // Skip signature verification in development/sandbox
  if (process.env.NODE_ENV === 'production') {
    console.log("🔐 Verifying signature (Production mode)...");
    if (!signature) {
      throw new Error("Signature is required in production");
    }
    
    if (!duitku.verifyCallback(merchantCode, amount, merchantOrderId, signature)) {
      throw new Error("Invalid signature - callback rejected");
    }
    console.log("✅ Signature verified successfully");
  } else {
    console.log("🚀 Development mode - skipping signature verification");
  }

  // Find payment record
  const payment = await prisma.payment.findUnique({
    where: { merchantOrderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
    },
  });

  if (!payment) {
    throw new Error(`Payment not found for merchantOrderId: ${merchantOrderId}`);
  }

  console.log(`📦 Payment found: ${payment.id} for user: ${payment.user.name}`);

  // Determine payment success
  const isSuccess = resultCode === "00";
  const newStatus = isSuccess ? "SUCCESS" : "FAILED";

  console.log(`📊 Payment result: ${resultCode} -> ${newStatus}`);

  // Update payment status
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      statusMessage: productDetail || `Callback result: ${resultCode}`,
      paidAt: isSuccess ? new Date() : null,
    },
  });

  console.log(`💾 Payment status updated: ${payment.merchantOrderId} -> ${newStatus}`);

  // Create subscription if payment successful and not already created
  if (isSuccess && !payment.subscriptionId) {
    console.log("🚀 Creating subscription...");

    // Check if user has ever subscribed (for new user promo)
    const hasEverSubscribed = await prisma.subscribe.count({
      where: { userId: payment.userId },
    });

    const isNewUser = hasEverSubscribed === 0;
    console.log(`👤 User type: ${isNewUser ? "NEW USER (gets promo)" : "EXISTING USER"}`);

    // Find package by price or default to STANDARD
    let subscriptionPackage = await prisma.subscriptionPackage.findFirst({
      where: { price: parseFloat(amount) },
    });

    if (!subscriptionPackage) {
      console.log("⚠️ Package not found by price, using STANDARD package");
      subscriptionPackage = await prisma.subscriptionPackage.findFirst({
        where: { name: "STANDARD" },
      });
    }

    if (!subscriptionPackage) {
      console.error("❌ No subscription package found!");
      throw new Error("No subscription package available");
    }

    console.log(`📦 Using package: ${subscriptionPackage.displayName}`);

    // Calculate subscription dates
    const now = new Date();
    const endDate = isNewUser 
      ? new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)) // New user: 60 days (1+1 month)
      : new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // Regular: 30 days

    console.log(`📅 Subscription period: ${now.toISOString()} to ${endDate.toISOString()}`);
    console.log(`⏰ Duration: ${isNewUser ? "60 days (New user promo)" : "30 days (Regular)"}`);

    // Create subscription
    const subscription = await prisma.subscribe.create({
      data: {
        userId: payment.userId,
        packageId: subscriptionPackage.id,
        status: "ACTIVE",
        startDate: now,
        endDate,
        isTrial: false,
        isNewUserPromo: isNewUser,
        paidMonths: 1,
        bonusMonths: isNewUser ? 1 : 0,
        totalMonths: isNewUser ? 2 : 1,
        autoRenew: true,
      },
    });

    console.log(`✅ Subscription created: ${subscription.id}`);

    // Link payment to subscription
    await prisma.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    });

    console.log("🔗 Payment linked to subscription");

    // Log success summary
    console.log("\n🎉 === SUBSCRIPTION ACTIVATION SUMMARY ===");
    console.log(`👤 User: ${payment.user.name} (${payment.user.email})`);
    console.log(`📦 Package: ${subscriptionPackage.displayName}`);
    console.log(`💰 Amount: Rp ${amount}`);
    console.log(`🎁 New User Promo: ${isNewUser ? "YES" : "NO"}`);
    console.log(`⏰ Access Duration: ${isNewUser ? "2 months" : "1 month"}`);
    console.log(`📅 Valid Until: ${endDate.toLocaleDateString('id-ID')}`);
    console.log("==============================================\n");
  }

  console.log("✅ Callback processing completed successfully");
  return updatedPayment;
};

// Get payment status
export const getPaymentStatus = async (merchantOrderId) => {
  console.log(`🔍 Getting payment status for: ${merchantOrderId}`);

  const payment = await prisma.payment.findUnique({
    where: { merchantOrderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      subscription: {
        include: {
          package: {
            select: {
              name: true,
              displayName: true,
              price: true,
              maxStores: true,
              maxMembers: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new Error(`Payment not found for merchantOrderId: ${merchantOrderId}`);
  }

  console.log(`📦 Payment status: ${payment.status}`);

  return {
    ...payment,
    isExpired: payment.expiredAt ? new Date() > payment.expiredAt : false,
    timeRemaining: payment.expiredAt ? Math.max(0, payment.expiredAt - new Date()) : null,
  };
};

// Get user payment history
export const getUserPaymentHistory = async (userId, page = 1, limit = 10) => {
  console.log(`📋 Getting payment history for user: ${userId}`);

  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      include: {
        subscription: {
          include: {
            package: {
              select: {
                name: true,
                displayName: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  console.log(`📊 Found ${payments.length} payments out of ${total} total`);

  // Add computed fields
  const enrichedPayments = payments.map(payment => ({
    ...payment,
    isExpired: payment.expiredAt ? new Date() > payment.expiredAt : false,
    statusLabel: getPaymentStatusLabel(payment.status),
    amountFormatted: `Rp ${payment.paymentAmount.toLocaleString('id-ID')}`,
  }));

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
  };
};

// Helper function to get payment status label
const getPaymentStatusLabel = (status) => {
  const labels = {
    PENDING: "Menunggu Pembayaran",
    SUCCESS: "Pembayaran Berhasil",
    FAILED: "Pembayaran Gagal",
    EXPIRED: "Kadaluarsa",
  };
  return labels[status] || status;
};
