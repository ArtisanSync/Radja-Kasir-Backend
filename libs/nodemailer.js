import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email verification
export const sendVerificationEmail = async (email, token, name) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "email-verification.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace template variables
    htmlTemplate = htmlTemplate.replace("{{name}}", name);
    htmlTemplate = htmlTemplate.replace("{{token}}", token);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email - Radja Kasir",
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

// Send reset password email
export const sendResetPasswordEmail = async (email, token, name) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "reset-password-token.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace template variables
    htmlTemplate = htmlTemplate.replace("{{name}}", name);
    htmlTemplate = htmlTemplate.replace("{{token}}", token);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Password Request - Radja Kasir",
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};
