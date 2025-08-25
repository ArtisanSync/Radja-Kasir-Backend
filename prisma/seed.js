import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Subscription Packages
  console.log("📦 Seeding Subscription Packages...");
  const packageTypes = ["STANDARD", "PRO", "BUSINESS"];
  const durations = [1, 3, 6, 12];
  const priceMultipliers = {
    STANDARD: 75000,
    PRO: 150000,
    BUSINESS: 250000,
  };
  const maxMembers = {
    STANDARD: 3,
    PRO: 5,
    BUSINESS: 7,
  };
  const maxStores = {
    STANDARD: 1,
    PRO: 3,
    BUSINESS: 5,
  };

  // Fungsi untuk menghitung diskon berdasarkan durasi
  const getDiscountMultiplier = (duration) => {
    switch (duration) {
      case 3:
        return 0.9;
      case 6:
        return 0.85;
      case 12:
        return 0.8;
      default:
        return 1;
    }
  };

  const packagePromises = [];

  for (const packageType of packageTypes) {
    for (const duration of durations) {
      const basePrice = priceMultipliers[packageType];
      const discountMultiplier = getDiscountMultiplier(duration);
      const finalPrice = Math.round(basePrice * duration * discountMultiplier);
      let displayName = `${packageType.charAt(0)}${packageType
        .slice(1)
        .toLowerCase()}`;
      if (duration > 1) {
        const discount = (1 - discountMultiplier) * 100;
        displayName += ` ${duration} Bulan (Hemat ${discount}%)`;
      } else {
        displayName += ` ${duration} Bulan`;
      }

      packagePromises.push(
        prisma.subscriptionPackage.upsert({
          where: {
            name_duration: {
              name: packageType,
              duration: duration,
            },
          },
          update: {
            displayName,
            price: finalPrice,
            maxUsers: 1,
            maxMembers: maxMembers[packageType],
            maxStores: maxStores[packageType],
            isActive: true,
          },
          create: {
            name: packageType,
            displayName,
            duration: duration,
            price: finalPrice,
            maxUsers: 1,
            maxMembers: maxMembers[packageType],
            maxStores: maxStores[packageType],
            isActive: true,
          },
        })
      );
    }
  }

  const packages = await Promise.all(packagePromises);

  console.log(`✅ Created ${packages.length} subscription packages`);

  // 2. Seed Units
  console.log("📏 Seeding Units...");
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

  // 3. Seed Admin User (NO STORE, NO SUBSCRIPTION)
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

  // 4. Seed Test User (NO SUBSCRIPTION)
  console.log("👤 Seeding Test User (No Subscription)...");
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

  // 5. Seed Active User dengan PRO Subscription (3 STORES)
  console.log("👤 Seeding Active User with PRO Package...");
  const activeUserPassword = await bcrypt.hash("@Active123", 10);

  let activeUser;
  try {
    activeUser = await prisma.user.create({
      data: {
        name: "Active User",
        email: "active@user.com",
        password: activeUserPassword,
        role: "USER",
        businessName: "Multi Store Business",
        businessType: "Retail Chain",
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

  // 6. Create Active User PRO Subscription
  console.log("💎 Creating Active User PRO Subscription...");
  const proPackage = packages.find((p) => p.name === "PRO");

  let activeSubscription;
  try {
    activeSubscription = await prisma.subscribe.create({
      data: {
        userId: activeUser.id,
        packageId: proPackage.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        isTrial: false,
        isNewUserPromo: true,
        paidMonths: 1,
        bonusMonths: 1,
        totalMonths: 2,
        autoRenew: true,
      },
    });
    console.log("✅ Active user PRO subscription created");
  } catch (error) {
    console.log("⚠️  Active user subscription already exists");
    activeSubscription = await prisma.subscribe.findFirst({
      where: { userId: activeUser.id },
    });
  }

  // 7. Create 3 Stores for Active User
  console.log("🏪 Creating 3 Stores for Active User...");
  const storeNames = [
    {
      name: "Toko Sukses Jaya 1",
      type: "Retail",
      address: "Jl. Sukses No. 1, Jakarta",
    },
    {
      name: "Toko Sukses Jaya 2",
      type: "Wholesale",
      address: "Jl. Sukses No. 2, Jakarta",
    },
    {
      name: "Toko Sukses Jaya 3",
      type: "Online",
      address: "Jl. Sukses No. 3, Jakarta",
    },
  ];

  const createdStores = [];
  for (const storeData of storeNames) {
    try {
      const store = await prisma.store.create({
        data: {
          name: storeData.name,
          storeType: storeData.type,
          description: `${storeData.type} store dengan subscription aktif`,
          address: storeData.address,
          phone: "+628123456789",
          whatsapp: "+628123456789",
          email: `${storeData.name
            .toLowerCase()
            .replace(/\s+/g, "")}@suksesjaya.com`,
          userId: activeUser.id,
        },
      });

      await prisma.storeSetting.create({
        data: {
          storeId: store.id,
          tax: 10,
          currency: "IDR",
          timezone: "Asia/Jakarta",
        },
      });

      createdStores.push(store);
      console.log(`✅ Store created: ${store.name}`);
    } catch (error) {
      console.log(`⚠️  Store ${storeData.name} might already exist`);
    }
  }

  // 8. Create 9 Member Users (3 per store)
  console.log("👥 Creating 9 Member Users...");
  const memberUsers = [];

  for (let i = 1; i <= 9; i++) {
    const memberPassword = await bcrypt.hash(`@Member${i}23`, 10);

    try {
      const memberUser = await prisma.user.create({
        data: {
          name: `Member ${i}`,
          email: `member${i}@test.com`,
          password: memberPassword,
          role: "MEMBER",
          emailVerifiedAt: new Date(),
        },
      });
      memberUsers.push(memberUser);
      console.log(`✅ Member user created: ${memberUser.email}`);
    } catch (error) {
      if (error.code === "P2002") {
        const existingMember = await prisma.user.findUnique({
          where: { email: `member${i}@test.com` },
        });
        memberUsers.push(existingMember);
        console.log(`⚠️  Member user already exists: member${i}@test.com`);
      } else {
        throw error;
      }
    }
  }

  // 9. Assign 3 members to each store
  console.log("🔗 Assigning Members to Stores...");
  const roles = ["CASHIER", "MANAGER", "CASHIER"];

  for (let storeIndex = 0; storeIndex < createdStores.length; storeIndex++) {
    const store = createdStores[storeIndex];

    for (let memberIndex = 0; memberIndex < 3; memberIndex++) {
      const memberUser = memberUsers[storeIndex * 3 + memberIndex];
      const tempPassword = await bcrypt.hash(
        `TEMP${storeIndex}${memberIndex}`,
        10
      );

      try {
        await prisma.storeMember.create({
          data: {
            storeId: store.id,
            userId: memberUser.id,
            email: memberUser.email,
            password: tempPassword,
            role: roles[memberIndex],
            isActive: true,
          },
        });
        console.log(
          `✅ Member ${memberUser.name} assigned to ${store.name} as ${roles[memberIndex]}`
        );
      } catch (error) {
        console.log(`⚠️  Member relationship might already exist`);
      }
    }
  }

  // 10. Get units for products
  const allUnits = await prisma.unit.findMany();
  const pcsUnit = allUnits.find((u) => u.name === "PCS");

  // 11. Create sample categories and products for each store
  console.log("📦 Creating Categories and Products for each store...");

  for (const store of createdStores) {
    // Create categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          storeId: store.id,
          name: "Makanan",
        },
      }),
      prisma.category.create({
        data: {
          storeId: store.id,
          name: "Minuman",
        },
      }),
    ]);

    // Create sample products
    const products = [
      {
        categoryId: categories[0].id,
        name: "Nasi Goreng",
        code: `NG${store.id.slice(-4)}`,
        brand: store.name,
        variants: [
          {
            name: "Porsi Normal",
            unitId: pcsUnit.id,
            quantity: 100,
            capitalPrice: 8000,
            price: 15000,
          },
        ],
      },
      {
        categoryId: categories[1].id,
        name: "Es Teh",
        code: `ET${store.id.slice(-4)}`,
        brand: store.name,
        variants: [
          {
            name: "Gelas",
            unitId: pcsUnit.id,
            quantity: 200,
            capitalPrice: 2000,
            price: 5000,
          },
        ],
      },
    ];

    for (const productData of products) {
      try {
        const product = await prisma.product.create({
          data: {
            storeId: store.id,
            categoryId: productData.categoryId,
            name: productData.name,
            code: productData.code,
            brand: productData.brand,
            isActive: true,
          },
        });

        for (const variantData of productData.variants) {
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              unitId: variantData.unitId,
              name: variantData.name,
              quantity: variantData.quantity,
              capitalPrice: variantData.capitalPrice,
              price: variantData.price,
              isActive: true,
            },
          });
        }
        console.log(`✅ Product ${productData.name} created for ${store.name}`);
      } catch (error) {
        console.log(`⚠️ Product ${productData.name} might already exist`);
      }
    }
  }

  // 12. Create sample customers for the first store
  console.log("👥 Creating Sample Customers...");
  const firstStore = createdStores[0];
  if (firstStore) {
    const customerData = [
      {
        name: "Pelanggan Umum",
        phone: "+628111111111",
        email: "umum@customer.com",
      },
      {
        name: "Budi Santoso",
        phone: "+628222222222",
        email: "budi@customer.com",
      },
      {
        name: "Siti Rahayu",
        phone: "+628333333333",
        email: "siti@customer.com",
      },
    ];

    for (const customer of customerData) {
      try {
        await prisma.customer.create({
          data: {
            storeId: firstStore.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: "Jakarta",
          },
        });
        console.log(`✅ Customer ${customer.name} created`);
      } catch (error) {
        console.log(`⚠️ Customer ${customer.name} might already exist`);
      }
    }
  }

  // 13. Create sample payment record
  console.log("💳 Creating Sample Payment...");
  if (activeSubscription) {
    try {
      await prisma.payment.create({
        data: {
          userId: activeUser.id,
          subscriptionId: activeSubscription.id,
          merchantCode: "DS24351",
          reference: "REF_SAMPLE_001",
          merchantOrderId: "ORDER_SAMPLE_001",
          paymentAmount: proPackage.price,
          productDetail: `Subscription ${proPackage.displayName}`,
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
  }

  // 14. Summary
  console.log("\n🎉 Seeding Summary:");
  console.log("==================");
  console.log("📦 Subscription Packages:");
  console.log("   1. Standard (1 user, 3 members, 1 store) - Rp 75.000");
  console.log("   2. Pro (1 user, 5 members, 3 stores) - Rp 150.000");
  console.log("   3. Business (1 user, 7 members, 5 stores) - Rp 250.000");
  console.log("");
  console.log("👑 Admin Account:");
  console.log(`   Email: admin@radjakasir.com`);
  console.log(`   Password: @Admin123`);
  console.log(`   Role: ADMIN (No store, No subscription, Full access)`);
  console.log("");
  console.log("👤 Test User Account (NO SUBSCRIPTION):");
  console.log(`   Email: user@user.com`);
  console.log(`   Password: @User123`);
  console.log(`   Status: Perlu subscribe untuk akses fitur`);
  console.log("");
  console.log("👤 Active User Account (PRO SUBSCRIPTION):");
  console.log(`   Email: active@user.com`);
  console.log(`   Password: @Active123`);
  console.log(`   Subscription: PRO (2 bulan) - NEW USER PROMO`);
  console.log(`   Stores: 3 stores (Toko Sukses Jaya 1, 2, 3)`);
  console.log(`   Members: 9 members total (3 per store)`);
  console.log("");
  console.log("👥 Member Accounts:");
  for (let i = 1; i <= 9; i++) {
    console.log(`   Email: member${i}@test.com`);
    console.log(`   Password: @Member${i}23`);
  }
  console.log("");
  console.log("🚀 Ready for production deployment!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
