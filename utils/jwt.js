import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth.js";

// Generate access token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn,
  });
};

// Generate 6-digit random token
export const generateRandomToken = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Verify JWT token (for login)
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.secret);
  } catch (error) {
    console.error("JWT verification error:", error);
    throw error;
  }
};
