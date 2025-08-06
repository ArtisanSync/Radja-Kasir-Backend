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
// Send invitation email
export const sendInvitationEmail = async (email, inviteCode, storeName, inviterName) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "invitation-email.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate.replaceAll("{{inviteCode}}", inviteCode);
    htmlTemplate = htmlTemplate.replaceAll("{{storeName}}", storeName);
    htmlTemplate = htmlTemplate.replaceAll("{{inviterName}}", inviterName);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invitation to join ${storeName} - Radja Kasir`,
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

// Send subscription reminder email
export const sendSubscriptionReminderEmail = async (email, userName, packageName, daysLeft, reminderType) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "subscription-reminder.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate.replaceAll("{{userName}}", userName);
    htmlTemplate = htmlTemplate.replaceAll("{{packageName}}", packageName);
    htmlTemplate = htmlTemplate.replaceAll("{{daysLeft}}", daysLeft);

    if (reminderType === "first") {
      htmlTemplate = htmlTemplate.replaceAll("{{reminderTitle}}", "Subscription Reminder - 7 Days Left");
      htmlTemplate = htmlTemplate.replaceAll("{{reminderMessage}}", "Your subscription will expire in 7 days. Don't miss out on uninterrupted service!");
    } else {
      htmlTemplate = htmlTemplate.replaceAll("{{reminderTitle}}", "Urgent: Subscription Expiring Soon - 3 Days Left");
      htmlTemplate = htmlTemplate.replaceAll("{{reminderMessage}}", "Your subscription will expire in just 3 days! Renew now to avoid service interruption.");
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `${reminderType === "first" ? "Subscription Reminder" : "Urgent: Subscription Expiring Soon"} - Radja Kasir`,
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Subscription reminder email send error:", error);
    return false;
  }
};