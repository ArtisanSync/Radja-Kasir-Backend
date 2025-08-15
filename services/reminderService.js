import prisma from "../config/prisma.js";
import { sendSubscriptionReminderEmail } from "../libs/nodemailer.js";

// Send reminder 7 days before subscription expires
export const sendFirstReminder = async () => {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  sevenDaysFromNow.setHours(0, 0, 0, 0);
  const endOfDay = new Date(sevenDaysFromNow);
  endOfDay.setHours(23, 59, 59, 999);

  const expiringSubscriptions = await prisma.subscribe.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: {
        gte: sevenDaysFromNow,
        lte: endOfDay,
      },
      // Only send first reminder once
      firstReminderSent: { not: true }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      package: {
        select: {
          displayName: true,
          price: true,
        },
      },
    },
  });

  console.log(`First reminder: processing ${expiringSubscriptions.length} subscriptions`);

  for (const subscription of expiringSubscriptions) {
    try {
      await sendSubscriptionReminderEmail(
        subscription.user.email,
        subscription.user.name,
        subscription.package.displayName,
        7,
        "first"
      );

      // Mark first reminder as sent
      await prisma.subscribe.update({
        where: { id: subscription.id },
        data: { firstReminderSent: true },
      });
    } catch (error) {
      console.error(`Failed to send first reminder to ${subscription.user.email}:`, error);
    }
  }

  return {
    processed: expiringSubscriptions.length,
    message: `First reminder sent to ${expiringSubscriptions.length} users`,
  };
};

// Send reminder 3 days before subscription expires
export const sendSecondReminder = async () => {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  
  threeDaysFromNow.setHours(0, 0, 0, 0);
  const endOfDay = new Date(threeDaysFromNow);
  endOfDay.setHours(23, 59, 59, 999);

  const expiringSubscriptions = await prisma.subscribe.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: {
        gte: threeDaysFromNow,
        lte: endOfDay,
      },
      secondReminderSent: { not: true }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      package: {
        select: {
          displayName: true,
          price: true,
        },
      },
    },
  });

  console.log(`Second reminder: processing ${expiringSubscriptions.length} subscriptions`);

  for (const subscription of expiringSubscriptions) {
    try {
      await sendSubscriptionReminderEmail(
        subscription.user.email,
        subscription.user.name,
        subscription.package.displayName,
        3,
        "second"
      );

      // Mark second reminder as sent
      await prisma.subscribe.update({
        where: { id: subscription.id },
        data: { secondReminderSent: true },
      });
    } catch (error) {
      console.error(`Failed to send second reminder to ${subscription.user.email}:`, error);
    }
  }

  return {
    processed: expiringSubscriptions.length,
    message: `Second reminder sent to ${expiringSubscriptions.length} users`,
  };
};

// Auto-expire subscriptions
export const expireSubscriptions = async () => {
  const now = new Date();

  const expiredSubscriptions = await prisma.subscribe.updateMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      endDate: { lt: now },
    },
    data: {
      status: "EXPIRED",
      cancelledAt: now,
    },
  });

  console.log(`Expired ${expiredSubscriptions.count} subscriptions`);

  return {
    expired: expiredSubscriptions.count,
    message: `${expiredSubscriptions.count} subscriptions expired`,
  };
};

// Run all reminder checks (untuk cron job)
export const runReminderChecks = async () => {
  const results = {
    firstReminders: await sendFirstReminder(),
    secondReminders: await sendSecondReminder(),
    expiredSubscriptions: await expireSubscriptions(),
    timestamp: new Date().toISOString(),
  };

  console.log("Reminder checks completed:", results);
  return results;
};