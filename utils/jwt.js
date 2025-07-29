import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth.js";

// Generate access token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn,
  });
};

// Generate reset token
export const generateResetToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.resetTokenExpiresIn,
  });
};

// Generate email verification token
export const generateVerificationToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: "24h",
  });
};

// Verify token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.secret);
  } catch (error) {
    console.error("JWT verification error:", error);
    throw error;
  }
};
