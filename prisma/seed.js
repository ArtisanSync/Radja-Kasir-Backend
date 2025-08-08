import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Subscription Packages (BARU)
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

  // 4. Seed Test User (NEW USER - belum punya toko dan subscription)
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

  // 5. Create Admin Subscription (Pro - 1 year)
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

  // 6. Seed Admin Store
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

    // Create store settings for admin store
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

  // 7. Seed Sample Categories (for admin store)
  if (adminStore) {
    console.log("📁 Seeding Sample Categories...");

    const categories = [
      { name: "Makanan", storeId: adminStore.id },
      { name: "Minuman", storeId: adminStore.id },
      { name: "Snack", storeId: adminStore.id },
      { name: "Elektronik", storeId: adminStore.id },
      { name: "Pakaian", storeId: adminStore.id },
    ];

    for (const category of categories) {
      try {
        const newCategory = await prisma.category.create({
          data: category,
        });
        console.log(`✅ Category created: ${newCategory.name}`);
      } catch (error) {
        if (error.code === "P2002") {
          console.log(`⚠️  Category already exists: ${category.name}`);
        } else {
          throw error;
        }
      }
    }
  }

  // 8. Summary
  console.log("\n📊 Seeding Summary:");
  console.log("==================");
  console.log("💳 Subscription Packages:");
  console.log("   1. Standard (1 user, 3 members, 1 store) - Rp 50.000");
  console.log("   2. Pro (1 user, 5 members, 3 stores) - Rp 100.000");
  console.log("   3. Business (1 user, 7 members, 5 stores) - Rp 200.000");
  console.log("");
  console.log("👑 Admin Account:");
  console.log(`   Email: admin@radjakasir.com`);
  console.log(`   Password: @Admin123`);
  console.log(`   Has Store: Yes (Admin Store)`);
  console.log(`   Subscription: Pro (1 year)`);
  console.log("");
  console.log("👤 Test User Account (NEW USER - untuk testing flow):");
  console.log(`   Email: user@user.com`);
  console.log(`   Password: @User123`);
  console.log(`   Has Store: NO - must create first store`);
  console.log(`   Subscription: None yet - will get promo when completing payment`);
  console.log(`   Business Profile: Sudah ada sesuai mobile UI`);
  console.log("");
  console.log("🚀 NEW USER FLOW (sesuai requirement):");
  console.log("   1. Register (name, email, password)");
  console.log("   2. Verify email");
  console.log("   3. Login → hasStore: false, isSubscribed: false");
  console.log("   4. Frontend: redirect to create first store");
  console.log("   5. POST /api/v1/stores/first → create store");
  console.log("   6. POST /api/v1/payments/create → create payment");
  console.log("   7. User pays via Duitku → payment callback");
  console.log("   8. Callback success → create subscription (1 bulan bayar + 1 bulan bonus)");
  console.log("   9. User gets 2 bulan akses penuh");
  console.log("");
  console.log("💳 Payment Gateway:");
  console.log("   - Duitku integration ready");
  console.log("   - Callback URL: https://radkasir.com/api/v1/payments/callback");
  console.log("   - Return URL: https://radkasir.com/payment/success");
  console.log("");
  console.log("📧 Email Features:");
  console.log("   - Email verification");
  console.log("   - Password reset");
  console.log("   - Store invitation codes");
  console.log("   - Subscription reminders (7 & 3 hari sebelum expire)");
  console.log("");
  console.log("✅ Ready for mobile app testing!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });