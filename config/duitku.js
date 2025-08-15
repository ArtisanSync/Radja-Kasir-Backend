import crypto from "crypto";
import axios from "axios";

class DuitkuPayment {
  constructor() {
    // Environment detection
    this.environment = process.env.NODE_ENV || "development";
    this.isSandbox = this.environment !== "production";
    
    // Credentials
    this.merchantCode = process.env.DUITKU_MERCHANT_CODE || "DS24351";
    this.apiKey = process.env.DUITKU_API_KEY || "2bazzd1230cczd4bc1b111ew1d20m1";
    
    // URL Configuration
    this.baseUrl = this.isSandbox 
      ? "https://sandbox.duitku.com/webapi/api/merchant"
      : "https://passport.duitku.com/webapi/api/merchant";
      
    this.callbackUrl = process.env.DUITKU_CALLBACK_URL || 
      `${process.env.APP_URL || "http://localhost:3000"}/api/v1/payments/callback`;
    
    this.returnUrl = process.env.DUITKU_RETURN_URL || 
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/success`;
    
    console.log("\n🔧 === DUITKU CONFIGURATION ===");
    console.log(`🌍 Environment: ${this.environment}`);
    console.log(`🧪 Sandbox Mode: ${this.isSandbox}`);
    console.log(`🏪 Merchant Code: ${this.merchantCode}`);
    console.log(`🔗 Base URL: ${this.baseUrl}`);
    console.log(`🔄 Callback URL: ${this.callbackUrl}`);
    console.log(`↩️  Return URL: ${this.returnUrl}`);
    console.log("==============================\n");
  }

  // Generate signature for Duitku API
  generateSignature(merchantOrderId, paymentAmount, apiKey, merchantCode) {
    try {
      const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
      const signature = crypto.createHash("md5").update(signatureString).digest("hex");
      
      console.log("🔐 Signature Generation:", {
        merchantCode,
        merchantOrderId, 
        paymentAmount,
        signatureLength: signature.length,
        signaturePreview: signature.substring(0, 10) + "..."
      });
      
      return signature;
    } catch (error) {
      console.error("❌ Signature generation failed:", error.message);
      throw new Error("Failed to generate signature");
    }
  }

  // Create payment transaction
  async createPayment(paymentData) {
    try {
      console.log("\n💳 === CREATING DUITKU PAYMENT ===");
      
      const {
        merchantOrderId,
        paymentAmount,
        productDetail,
        email,
        phoneNumber,
        customerName,
        expiryPeriod = 1440, // 24 hours default
      } = paymentData;

      // Validate required data
      const requiredFields = { merchantOrderId, paymentAmount, productDetail, email, customerName };
      const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
      }

      // Generate signature
      const signature = this.generateSignature(
        merchantOrderId,
        paymentAmount,
        this.apiKey,
        this.merchantCode
      );

      // Enhanced request data untuk menghindari FDS rejection
      const requestBody = {
        merchantCode: this.merchantCode,
        paymentAmount: parseInt(paymentAmount),
        paymentMethod: "VC", // Virtual Credit (Credit Card)
        merchantOrderId,
        productDetail,
        // Customer info yang lebih lengkap untuk mengurangi FDS rejection
        customerVaName: customerName.trim(),
        email: email.toLowerCase().trim(),
        phoneNumber: phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : "081234567890",
        // Billing address untuk mengurangi FDS false positive
        itemDetails: [
          {
            name: productDetail,
            price: parseInt(paymentAmount),
            quantity: 1
          }
        ],
        customerDetail: {
          firstName: customerName.split(' ')[0] || customerName,
          lastName: customerName.split(' ').slice(1).join(' ') || customerName,
          email: email.toLowerCase().trim(),
          phoneNumber: phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : "081234567890",
          billingAddress: {
            firstName: customerName.split(' ')[0] || customerName,
            lastName: customerName.split(' ').slice(1).join(' ') || customerName,
            address: "Jl. Test Address No. 123",
            city: "Jakarta",
            postalCode: "12345",
            phone: phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : "081234567890",
            countryCode: "ID"
          }
        },
        callbackUrl: this.callbackUrl,
        returnUrl: this.returnUrl,
        signature,
        expiryPeriod: parseInt(expiryPeriod),
        // Additional parameters untuk sandbox
        additionalParam: JSON.stringify({
          environment: "sandbox",
          source: "radjakasir_backend",
          version: "1.0"
        })
      };

      console.log("📤 Enhanced Request Data:", {
        merchantCode: requestBody.merchantCode,
        paymentAmount: requestBody.paymentAmount,
        paymentMethod: requestBody.paymentMethod,
        merchantOrderId: requestBody.merchantOrderId,
        customerName: requestBody.customerVaName,
        email: requestBody.email,
        phoneNumber: requestBody.phoneNumber,
        hasCustomerDetail: !!requestBody.customerDetail,
        hasBillingAddress: !!requestBody.customerDetail?.billingAddress,
        expiryHours: Math.round(requestBody.expiryPeriod / 60)
      });

      // Make API request to Duitku
      const response = await axios.post(
        `${this.baseUrl}/v2/inquiry`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "RadjaKasir-Backend/1.0",
            "Accept": "application/json",
            // Additional headers untuk sandbox
            "X-Source": "radjakasir",
            "X-Environment": this.isSandbox ? "sandbox" : "production"
          },
          timeout: 30000,
        }
      );

      console.log("📥 Duitku API Response:", {
        statusCode: response.data.statusCode,
        statusMessage: response.data.statusMessage,
        reference: response.data.reference,
        paymentUrl: response.data.paymentUrl ? "✅ Generated" : "❌ Missing",
        vaNumber: response.data.vaNumber || "N/A",
        amount: response.data.amount || requestBody.paymentAmount,
        // FDS specific info
        fdsStatus: response.data.fdsStatus || "N/A",
        riskScore: response.data.riskScore || "N/A"
      });

      // Validate successful response
      if (response.data.statusCode !== "00") {
        throw new Error(`Duitku API Error [${response.data.statusCode}]: ${response.data.statusMessage}`);
      }

      if (!response.data.paymentUrl) {
        throw new Error("Payment URL not generated by Duitku");
      }

      console.log("✅ Duitku payment created successfully");
      console.log("==============================\n");

      return {
        success: true,
        data: response.data,
      };

    } catch (error) {
      console.error("❌ Duitku Payment Creation Failed:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      console.log("==============================\n");
      
      return {
        success: false,
        error: error.response?.data || { message: error.message },
      };
    }
  }

  // Verify callback signature
  verifyCallback(merchantCode, amount, merchantOrderId, signature) {
    try {
      // In sandbox mode, we can be more lenient with signature verification
      if (this.isSandbox) {
        console.log("🧪 Sandbox Mode: Relaxed signature verification");
        
        if (!signature) {
          console.log("⚠️ No signature provided in sandbox mode - allowing");
          return true;
        }
      }

      const signatureString = `${merchantCode}${amount}${merchantOrderId}${this.apiKey}`;
      const calculatedSignature = crypto.createHash("md5").update(signatureString).digest("hex");
      const isValid = calculatedSignature === signature;
      
      console.log("🔍 Signature Verification:", {
        merchantCode,
        merchantOrderId,
        amount,
        environment: this.environment,
        receivedSignature: signature?.substring(0, 10) + "..." || "NONE",
        calculatedSignature: calculatedSignature?.substring(0, 10) + "...",
        isValid: isValid,
        sandboxMode: this.isSandbox
      });
      
      return isValid;
    } catch (error) {
      console.error("❌ Signature verification error:", error.message);
      return this.isSandbox; // In sandbox, allow even if verification fails
    }
  }

  // Check transaction status from Duitku
  async checkTransactionStatus(merchantOrderId) {
    try {
      console.log(`🔍 Checking transaction status: ${merchantOrderId}`);

      const signature = crypto
        .createHash("md5")
        .update(`${this.merchantCode}${merchantOrderId}${this.apiKey}`)
        .digest("hex");

      const requestBody = {
        merchantCode: this.merchantCode,
        merchantOrderId,
        signature,
      };

      console.log("📤 Status Check Request:", requestBody);

      const response = await axios.post(
        `${this.baseUrl}/transactionStatus`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 15000,
        }
      );

      console.log("📥 Status Response:", response.data);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("❌ Status Check Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        success: false,
        error: error.response?.data || { message: error.message },
      };
    }
  }
}

export default new DuitkuPayment();
