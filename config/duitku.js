import crypto from "crypto";
import axios from "axios";

class DuitkuPayment {
  constructor() {
    this.merchantCode = process.env.DUITKU_MERCHANT_CODE || "DS24351";
    this.apiKey = process.env.DUITKU_API_KEY || "2bazzd1230cczd4bc1b111ew1d20m1";
    
    // Environment-based URL configuration
    this.baseUrl = process.env.NODE_ENV === "production" 
      ? "https://passport.duitku.com/webapi/api/merchant"
      : "https://sandbox.duitku.com/webapi/api/merchant";
      
    this.callbackUrl = process.env.DUITKU_CALLBACK_URL || "http://localhost:3000/api/v1/payments/callback";
    this.returnUrl = process.env.DUITKU_RETURN_URL || "http://localhost:3000/payment/success";
    
    console.log(`🔧 Duitku Config - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Base URL: ${this.baseUrl}`);
    console.log(`🔧 Callback URL: ${this.callbackUrl}`);
  }

  // Generate signature
  generateSignature(merchantOrderId, paymentAmount, apiKey, merchantCode) {
    const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
    const signature = crypto.createHash("md5").update(signatureString).digest("hex");
    
    console.log("🔐 Signature Generation:", {
      merchantCode,
      merchantOrderId, 
      paymentAmount,
      signatureString: signatureString.substring(0, 50) + "...", // Hide sensitive data
      signature
    });
    
    return signature;
  }

  // Create payment
  async createPayment(paymentData) {
    try {
      const {
        merchantOrderId,
        paymentAmount,
        productDetail,
        email,
        phoneNumber,
        customerName,
        expiryPeriod = 1440,
      } = paymentData;

      if (!merchantOrderId || !paymentAmount || !productDetail || !email || !customerName) {
        throw new Error("Missing required payment data");
      }

      const signature = this.generateSignature(
        merchantOrderId,
        paymentAmount,
        this.apiKey,
        this.merchantCode
      );

      // Format request body Duitku
      const requestBody = {
        merchantCode: this.merchantCode,
        paymentAmount: parseInt(paymentAmount),
        paymentMethod: "VC",
        merchantOrderId,
        productDetail,
        customerVaName: customerName,
        email,
        phoneNumber: phoneNumber || "081234567890",
        callbackUrl: this.callbackUrl,
        returnUrl: this.returnUrl,
        signature,
        expiryPeriod,
      };

      console.log("📤 Duitku Request:", {
        ...requestBody,
        signature: signature.substring(0, 10) + "...",
      });

      const response = await axios.post(
        `${this.baseUrl}/v2/inquiry`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Radja-Kasir-Backend/1.0"
          },
          timeout: 30000,
        }
      );

      console.log("📥 Duitku Response:", {
        statusCode: response.data.statusCode,
        statusMessage: response.data.statusMessage,
        reference: response.data.reference,
        paymentUrl: response.data.paymentUrl ? "✅ Generated" : "❌ Missing"
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("❌ Duitku Payment Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          data: "hidden_for_security"
        } : null
      });
      
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  // Verify callback signature
  verifyCallback(merchantCode, amount, merchantOrderId, signature) {
    try {
      const signatureString = `${merchantCode}${amount}${merchantOrderId}${this.apiKey}`;
      const calculatedSignature = crypto.createHash("md5").update(signatureString).digest("hex");
      const isValid = calculatedSignature === signature;
      
      console.log("🔍 Signature Verification:", {
        merchantCode,
        merchantOrderId,
        amount,
        received: signature?.substring(0, 10) + "...",
        calculated: calculatedSignature?.substring(0, 10) + "...",
        isValid
      });
      
      return isValid;
    } catch (error) {
      console.error("❌ Signature verification error:", error.message);
      return false;
    }
  }

  // Check transaction status
  async checkTransactionStatus(merchantOrderId) {
    try {
      const signature = this.generateSignature(
        merchantOrderId,
        "",
        this.apiKey,
        this.merchantCode
      );

      const response = await axios.post(
        `${this.baseUrl}/transactionStatus`,
        {
          merchantCode: this.merchantCode,
          merchantOrderId,
          signature,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("❌ Check Status Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }
}

export default new DuitkuPayment();