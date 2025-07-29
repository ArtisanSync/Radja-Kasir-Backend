export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRATION || "1d",
  resetTokenExpiresIn: "15m",
};

export const BCRYPT_ROUNDS = 10;

export const PASSWORD_RESET_CONFIG = {
  tokenExpiry: 15 * 60 * 1000,
  emailTemplate: "reset-password-token.html",
};
