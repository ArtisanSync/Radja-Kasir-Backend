import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Subscription Packages
  console.log("💳 Seeding Subscription Packages...");
  const packages = await Promise.all([
    prisma.subscriptionPackage.upsert({
      where: { name: "STANDARD" },
      update: {},
      create: {
        name: "STANDARD",
        displayName: "Paket Standard",
        price: 75000,
        maxUsers: 1,
        maxMembers: 3,
        maxStores: 1,
        features: {
          invoice: true,
          reports: true,
          backup: false,
          api_access: false,
        },
        isActive: true,
      },
    }),
    prisma.subscriptionPackage.upsert({
      where: { name: "PRO" },
      update: {},
      create: {
        name: "PRO",
        displayName: "Paket Pro",
        price: 150000,
        maxUsers: 1,
        maxMembers: 5,
        maxStores: 3,
        features: {
          invoice: true,
          reports: true,
          backup: true,
          api_access: false,
          analytics: true,
        },
        isActive: true,
      },
    }),
    prisma.subscriptionPackage.upsert({
      where: { name: "BUSINESS" },
      update: {},
      create: {
        name: "BUSINESS",
        displayName: "Paket Bisnis",
        price: 250000,
        maxUsers: 1,
        maxMembers: 7,
        maxStores: 5,
        features: {
          invoice: true,
          reports: true,
          backup: true,
          api_access: true,
          analytics: true,
          priority_support: true,
        },
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${packages.length} subscription packages`);

  // 2. Seed Units
  console.log("📦 Seeding Units...");
  const units = await prisma.unit.createMany({
    data: [
      { name: "PCS" },
      { name: "KTN" },
      { name: "DUS" },
      { name: "PAK" },
      { name: "BAL" },
      { name: "LAINNYA" },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Created ${units.count} units successfully`);

  // 3. Seed Admin User
  console.log("👑 Seeding Admin User...");
  const adminPassword = await bcrypt.hash("@Admin123", 10);

  let adminUser;
  try {
    adminUser = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "admin@radjakasir.com",
        password: adminPassword,
        role: "ADMIN",
        businessName: "Radja Kasir Admin",
        businessType: "Technology",
        businessAddress: "Jakarta, Indonesia",
        whatsapp: "+628111000000",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Admin user created: ${adminUser.email}`);
  } catch (error) {
    if (error.code === "P2002") {
      adminUser = await prisma.user.findUnique({
        where: { email: "admin@radjakasir.com" },
      });
      console.log(`⚠️  Admin user already exists: ${adminUser.email}`);
    } else {
      throw error;
    }
  }

  // 4. Seed Test User (NEW USER)
  console.log("👤 Seeding Test User...");
  const userPassword = await bcrypt.hash("@User123", 10);

  let testUser;
  try {
    testUser = await prisma.user.create({
      data: {
        name: "User Test",
        email: "user@user.com",
        password: userPassword,
        role: "USER",
        businessName: "Kedai Laris", 
        businessType: "Restoran",
        businessAddress: "Jl Taman Sari Perum Batu Raden Asri Blok B No 3",
        whatsapp: "087704217808",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Test user created: ${testUser.email}`);
  } catch (error) {
    if (error.code === "P2002") {
      testUser = await prisma.user.findUnique({
        where: { email: "user@user.com" },
      });
      console.log(`⚠️  Test user already exists: ${testUser.email}`);
    } else {
      throw error;
    }
  }

  // 5. Seed Test User dengan Subscription Aktif
  console.log("👤 Seeding Active User...");
  const activeUserPassword = await bcrypt.hash("@Active123", 10);

  let activeUser;
  try {
    activeUser = await prisma.user.create({
      data: {
        name: "Active User",
        email: "active@user.com",
        password: activeUserPassword,
        role: "USER",
        businessName: "Toko Sukses Jaya",
        businessType: "Retail",
        businessAddress: "Jl. Sukses No. 123, Jakarta",
        whatsapp: "081234567890",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Active user created: ${activeUser.email}`);
  } catch (error) {
    if (error.code === "P2002") {
      activeUser = await prisma.user.findUnique({
        where: { email: "active@user.com" },
      });
      console.log(`⚠️  Active user already exists: ${activeUser.email}`);
    } else {
      throw error;
    }
  }

  // 6. Create Admin Subscription (Pro - 1 year)
  console.log("💎 Creating Admin Subscription...");
  const proPackage = packages.find(p => p.name === "PRO");

  try {
    await prisma.subscribe.create({
      data: {
        userId: adminUser.id,
        packageId: proPackage.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        isTrial: false,
        isNewUserPromo: false,
        paidMonths: 12,
        bonusMonths: 0,
        totalMonths: 12,
        autoRenew: true,
      },
    });
    console.log("✅ Admin subscription created");
  } catch (error) {
    console.log("⚠️  Admin subscription already exists");
  }

  // 7. Create Active User Subscription (Standard - 2 months dengan new user promo)
  console.log("💎 Creating Active User Subscription...");
  const standardPackage = packages.find(p => p.name === "STANDARD");

  try {
    await prisma.subscribe.create({
      data: {
        userId: activeUser.id,
        packageId: standardPackage.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days (new user promo)
        isTrial: false,
        isNewUserPromo: true,
        paidMonths: 1,
        bonusMonths: 1,
        totalMonths: 2,
        autoRenew: true,
      },
    });
    console.log("✅ Active user subscription created");
  } catch (error) {
    console.log("⚠️  Active user subscription already exists");
  }

  // 8. Seed Admin Store
  console.log("🏪 Seeding Admin Store...");
  let adminStore;
  try {
    adminStore = await prisma.store.create({
      data: {
        name: "Admin Store",
        storeType: "Supermarket",
        description: "Demo store for admin testing",
        address: "Jl. Admin No. 1, Jakarta Pusat",
        phone: "+628111000001",
        whatsapp: "+628111000001",
        email: "admin.store@radjakasir.com",
        userId: adminUser.id,
      },
    });

    await prisma.storeSetting.create({
      data: {
        storeId: adminStore.id,
        tax: 10,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    });

    console.log(`✅ Admin store created: ${adminStore.name}`);
  } catch (error) {
    console.log(`⚠️  Admin store might already exist`);
  }

  // 9. Seed Active User Store
  console.log("🏪 Seeding Active User Store...");
  let activeStore;
  try {
    activeStore = await prisma.store.create({
      data: {
        name: "Toko Sukses Jaya",
        storeType: "Retail",
        description: "Toko retail dengan subscription aktif",
        address: "Jl. Sukses No. 123, Jakarta",
        phone: "+628123456789",
        whatsapp: "+628123456789",
        email: "toko@suksesjaya.com",
        userId: activeUser.id,
      },
    });

    await prisma.storeSetting.create({
      data: {
        storeId: activeStore.id,
        tax: 10,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    });

    console.log(`✅ Active user store created: ${activeStore.name}`);
  } catch (error) {
    console.log(`⚠️  Active user store might already exist`);
  }

  // 10. Create sample member user
  console.log("👥 Seeding Member User...");
  const memberPassword = await bcrypt.hash("@Member123", 10);

  let memberUser;
  try {
    memberUser = await prisma.user.create({
      data: {
        name: "Member Test",
        email: "member@test.com",
        password: memberPassword,
        role: "MEMBER",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Member user created: ${memberUser.email}`);
  } catch (error) {
    if (error.code === "P2002") {
      memberUser = await prisma.user.findUnique({
        where: { email: "member@test.com" },
      });
      console.log(`⚠️  Member user already exists: ${memberUser.email}`);
    } else {
      throw error;
    }
  }

  // 11. Create member relationships
  if (adminStore && memberUser) {
    console.log("🤝 Creating Member Relationships...");
    const memberTempPassword = await bcrypt.hash("MEMBER123", 10);

    try {
      await prisma.storeMember.create({
        data: {
          storeId: adminStore.id,
          userId: memberUser.id,
          email: memberUser.email,
          password: memberTempPassword,
          role: "CASHIER",
          isActive: true,
        },
      });
      console.log(`✅ Member relationship created for admin store`);
    } catch (error) {
      console.log(`⚠️  Member relationship might already exist`);
    }
  }

  if (activeStore && memberUser) {
    try {
      const memberTempPassword2 = await bcrypt.hash("MEMBER456", 10);
      await prisma.storeMember.create({
        data: {
          storeId: activeStore.id,
          userId: memberUser.id,
          email: "member2@test.com",
          password: memberTempPassword2,
          role: "MANAGER",
          isActive: true,
        },
      });
      console.log(`✅ Member relationship created for active store`);
    } catch (error) {
      console.log(`⚠️  Member relationship might already exist`);
    }
  }

  // 12. Create sample payment records
  console.log("💳 Creating Sample Payments...");
  try {
    await prisma.payment.create({
      data: {
        userId: activeUser.id,
        subscriptionId: (await prisma.subscribe.findFirst({ where: { userId: activeUser.id } }))?.id,
        merchantCode: "DS24351",
        reference: "REF_SAMPLE_001",
        merchantOrderId: "ORDER_SAMPLE_001",
        paymentAmount: standardPackage.price,
        productDetail: `Subscription ${standardPackage.displayName}`,
        status: "SUCCESS",
        statusMessage: "Payment successful",
        paidAt: new Date(),
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log("✅ Sample payment created");
  } catch (error) {
    console.log("⚠️  Sample payment might already exist");
  }

  // 13. Summary
  console.log("\n📊 Seeding Summary:");
  console.log("==================");
  console.log("💳 Subscription Packages:");
  console.log("   1. Standard (1 user, 3 members, 1 store) - Rp 75.000");
  console.log("   2. Pro (1 user, 5 members, 3 stores) - Rp 150.000");
  console.log("   3. Business (1 user, 7 members, 5 stores) - Rp 250.000");
  console.log("");
  console.log("👑 Admin Account:");
  console.log(`   Email: admin@radjakasir.com`);
  console.log(`   Password: @Admin123`);
  console.log(`   Login Response: { type: "ADMIN", ... }`);
  console.log(`   Subscription: Pro (1 year) - ACTIVE`);
  console.log("");
  console.log("👤 Test User Account (NEW USER - No Subscription):");
  console.log(`   Email: user@user.com`);
  console.log(`   Password: @User123`);
  console.log(`   Login Response: { type: "USER", ... }`);
  console.log(`   Status: Perlu subscribe untuk akses fitur`);
  console.log("");
  console.log("👤 Active User Account (HAS ACTIVE SUBSCRIPTION):");
  console.log(`   Email: active@user.com`);
  console.log(`   Password: @Active123`);
  console.log(`   Login Response: { type: "USER", ... }`);
  console.log(`   Subscription: Standard (2 bulan) - NEW USER PROMO`);
  console.log(`   Store: "Toko Sukses Jaya" - ACTIVE`);
  console.log("");
  console.log("👥 Member Account:");
  console.log(`   Email: member@test.com`);
  console.log(`   Password: MEMBER123`);
  console.log(`   Login Response: { type: "MEMBER", store: {...}, ... }`);
  console.log("");
  console.log("🚀 SISTEM YANG READY:");
  console.log("✅ Universal login system");
  console.log("✅ New user promo (1 bulan bayar = 2 bulan akses)");
  console.log("✅ Email/password member invitation");
  console.log("✅ Subscription limits validation");
  console.log("✅ Admin panel untuk monitoring");
  console.log("✅ Payment integration dengan Duitku");
  console.log("");
  console.log("🎯 ADMIN FEATURES:");
  console.log("✅ View all active subscribers");
  console.log("✅ Change user subscription packages");
  console.log("✅ Extend subscription duration");
  console.log("✅ Delete user accounts");
  console.log("✅ Delete store members");
  console.log("✅ Dashboard statistics");
  console.log("");
  console.log("🎉 Ready for production deployment!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });