import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

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
    if (!fs.existsSync(templatePath)) {
      console.error(`Email template not found: ${templatePath}`);
      return false;
    }

    let htmlTemplate = fs.readFileSync(templatePath, "utf8");
    htmlTemplate = htmlTemplate.replace(/\{\{name\}\}/g, name);
    htmlTemplate = htmlTemplate.replace(/\{\{token\}\}/g, token);

    const mailOptions = {
      from: `"Radja Kasir" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verifikasi Email - Radja Kasir",
      html: htmlTemplate,
    };

    console.log(`Sending verification email to ${email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent: ${info.messageId}`);
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
    if (!fs.existsSync(templatePath)) {
      console.error(`Email template not found: ${templatePath}`);
      return false;
    }

    let htmlTemplate = fs.readFileSync(templatePath, "utf8");
    htmlTemplate = htmlTemplate.replace(/\{\{name\}\}/g, name);
    htmlTemplate = htmlTemplate.replace(/\{\{token\}\}/g, token);

    const mailOptions = {
      from: `"Radja Kasir" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password - Radja Kasir",
      html: htmlTemplate,
    };

    console.log(`Sending reset password email to ${email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Reset password email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

// Send member invitation email with credentials
export const sendInvitationEmail = async (
  memberEmail, 
  memberName, 
  memberPassword, 
  storeName, 
  inviterName, 
  memberRole = "CASHIER"
) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "invitation-email.html"
    );
    if (!fs.existsSync(templatePath)) {
      console.error(`Email template not found: ${templatePath}`);
      return false;
    }

    let htmlTemplate = fs.readFileSync(templatePath, "utf8");
    htmlTemplate = htmlTemplate.replace(/\{\{memberName\}\}/g, memberName);
    htmlTemplate = htmlTemplate.replace(/\{\{memberEmail\}\}/g, memberEmail);
    htmlTemplate = htmlTemplate.replace(/\{\{memberPassword\}\}/g, memberPassword);
    htmlTemplate = htmlTemplate.replace(/\{\{storeName\}\}/g, storeName);
    htmlTemplate = htmlTemplate.replace(/\{\{inviterName\}\}/g, inviterName);
    
    const roleTranslation = {
      "CASHIER": "Kasir",
      "MANAGER": "Manager", 
      "ADMIN": "Admin"
    };
    
    htmlTemplate = htmlTemplate.replace(/\{\{memberRole\}\}/g, 
      roleTranslation[memberRole] || memberRole
    );

    const mailOptions = {
      from: `"Radja Kasir" <${process.env.EMAIL_USER}>`,
      to: memberEmail,
      subject: `Undangan Member Toko "${storeName}" - Radja Kasir`,
      html: htmlTemplate,
    };

    console.log(`Sending invitation email to ${memberEmail} for store ${storeName}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Invitation email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("Failed to send invitation email:", error);
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

    if (!fs.existsSync(templatePath)) {
      console.error(`Email template not found: ${templatePath}`);
      return false;
    }

    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate.replace(/\{\{userName\}\}/g, userName);
    htmlTemplate = htmlTemplate.replace(/\{\{packageName\}\}/g, packageName);
    htmlTemplate = htmlTemplate.replace(/\{\{daysLeft\}\}/g, daysLeft);

    if (reminderType === "first") {
      htmlTemplate = htmlTemplate.replace(/\{\{reminderTitle\}\}/g, "Subscription Reminder - 7 Hari Tersisa");
      htmlTemplate = htmlTemplate.replace(/\{\{reminderMessage\}\}/g, "Subscription Anda akan berakhir dalam 7 hari. Perpanjang sekarang agar layanan tidak terputus!");
    } else {
      htmlTemplate = htmlTemplate.replace(/\{\{reminderTitle\}\}/g, "Urgent: Subscription Hampir Berakhir - 3 Hari Tersisa");
      htmlTemplate = htmlTemplate.replace(/\{\{reminderMessage\}\}/g, "Subscription Anda akan berakhir dalam 3 hari! Perpanjang sekarang untuk menghindari gangguan layanan.");
    }

    const mailOptions = {
      from: `"Radja Kasir" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${reminderType === "first" ? "Pengingat Subscription" : "Urgent: Subscription Hampir Berakhir"} - Radja Kasir`,
      html: htmlTemplate,
    };

    console.log(`Sending subscription reminder to ${email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Subscription reminder email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("Subscription reminder email send error:", error);
    return false;
  }
};