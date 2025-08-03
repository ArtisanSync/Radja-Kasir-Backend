import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Units
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

  // 2. Seed Admin User
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
        isSubscribe: true,
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

  // 3. Seed Test User with Subscription
  console.log("👤 Seeding Test User...");
  const userPassword = await bcrypt.hash("@User123", 10);

  let testUser;
  try {
    testUser = await prisma.user.create({
      data: {
        name: "Test User",
        email: "user@test.com",
        password: userPassword,
        role: "USER",
        isSubscribe: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Test user created: ${testUser.email}`);
  } catch (error) {
    if (error.code === "P2002") {
      testUser = await prisma.user.findUnique({
        where: { email: "user@test.com" },
      });
      console.log(`⚠️  Test user already exists: ${testUser.email}`);
    } else {
      throw error;
    }
  }

  // 4. Seed Test Stores
  console.log("🏪 Seeding Test Stores...");

  // Admin Store
  let adminStore;
  try {
    adminStore = await prisma.store.create({
      data: {
        name: "Admin Store",
        storeType: "Supermarket",
        address: "Jl. Admin No. 1, Jakarta Pusat",
        whatsapp: "+628111000001",
        userId: adminUser.id,
      },
    });
    console.log(`✅ Admin store created: ${adminStore.name}`);
  } catch (error) {
    if (error.code === "P2002") {
      adminStore = await prisma.store.findFirst({
        where: { name: "Admin Store", userId: adminUser.id },
      });
      console.log(`⚠️  Admin store already exists: ${adminStore?.name}`);
    } else {
      throw error;
    }
  }

  // User Store 1
  let userStore1;
  try {
    userStore1 = await prisma.store.create({
      data: {
        name: "Toko Berkah",
        storeType: "Retail",
        address: "Jl. Berkah No. 123, Bandung",
        whatsapp: "+628222000001",
        userId: testUser.id,
      },
    });
    console.log(`✅ User store 1 created: ${userStore1.name}`);
  } catch (error) {
    if (error.code === "P2002") {
      userStore1 = await prisma.store.findFirst({
        where: { name: "Toko Berkah", userId: testUser.id },
      });
      console.log(`⚠️  User store 1 already exists: ${userStore1?.name}`);
    } else {
      throw error;
    }
  }

  // User Store 2
  let userStore2;
  try {
    userStore2 = await prisma.store.create({
      data: {
        name: "Warung Maju",
        storeType: "Warung",
        address: "Jl. Maju No. 456, Surabaya",
        whatsapp: "+628333000001",
        userId: testUser.id,
      },
    });
    console.log(`✅ User store 2 created: ${userStore2.name}`);
  } catch (error) {
    if (error.code === "P2002") {
      userStore2 = await prisma.store.findFirst({
        where: { name: "Warung Maju", userId: testUser.id },
      });
      console.log(`⚠️  User store 2 already exists: ${userStore2?.name}`);
    } else {
      throw error;
    }
  }

  // 5. Seed Sample Categories
  console.log("📁 Seeding Sample Categories...");

  const categories = [
    { name: "Makanan", storeId: userStore1.id },
    { name: "Minuman", storeId: userStore1.id },
    { name: "Snack", storeId: userStore1.id },
    { name: "Elektronik", storeId: userStore2.id },
    { name: "Pakaian", storeId: userStore2.id },
    { name: "Admin Category", storeId: adminStore.id },
  ];

  for (const category of categories) {
    try {
      const newCategory = await prisma.category.create({
        data: category,
      });
      console.log(
        `✅ Category created: ${newCategory.name} (Store: ${category.storeId})`
      );
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  Category already exists: ${category.name}`);
      } else {
        throw error;
      }
    }
  }

  // 6. Summary
  console.log("\n📊 Seeding Summary:");
  console.log("==================");
  console.log("👑 Admin Account:");
  console.log(`   Email: admin@radjakasir.com`);
  console.log(`   Password: @Admin123`);
  console.log(`   Role: ADMIN`);
  console.log("");
  console.log("👤 Test User Account:");
  console.log(`   Email: user@test.com`);
  console.log(`   Password: @User123`);
  console.log(`   Role: USER`);
  console.log("");
  console.log("🏪 Test Stores:");
  console.log(`   1. Admin Store (ID: ${adminStore.id})`);
  console.log(`   2. Toko Berkah (ID: ${userStore1.id})`);
  console.log(`   3. Warung Maju (ID: ${userStore2.id})`);
  console.log("");
  console.log("🚀 Ready for testing Category API!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
