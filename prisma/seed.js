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
  const proPackage = packages.find((p) => p.name === "PRO");

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
  const standardPackage = packages.find((p) => p.name === "STANDARD");

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

  // 12. Seed Categories and Products for Active Store
  if (activeStore) {
    console.log("🏷️ Seeding Categories and Products...");

    // Create categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          storeId: activeStore.id,
          name: "Makanan",
        },
      }),
      prisma.category.create({
        data: {
          storeId: activeStore.id,
          name: "Minuman",
        },
      }),
      prisma.category.create({
        data: {
          storeId: activeStore.id,
          name: "Snack",
        },
      }),
    ]);

    console.log(`✅ Created ${categories.length} categories`);

    // Get units
    const allUnits = await prisma.unit.findMany();
    const pcsUnit = allUnits.find((u) => u.name === "PCS");
    const pakUnit = allUnits.find((u) => u.name === "PAK");

    // Create products with variants
    const products = [
      // Makanan
      {
        categoryId: categories[0].id,
        name: "Nasi Pecel Ayam",
        code: "NPA001",
        brand: "Warung",
        variants: [
          {
            name: "Porsi Normal",
            unitId: pcsUnit.id,
            quantity: 950,
            capitalPrice: 8000,
            price: 12000,
          },
          {
            name: "Porsi Jumbo",
            unitId: pcsUnit.id,
            quantity: 100,
            capitalPrice: 12000,
            price: 18000,
          },
        ],
      },
      {
        categoryId: categories[0].id,
        name: "Nasi Pecel Telur",
        code: "NPT001",
        brand: "Warung",
        variants: [
          {
            name: "Default",
            unitId: pcsUnit.id,
            quantity: 29,
            capitalPrice: 6000,
            price: 10000,
          },
        ],
      },
      {
        categoryId: categories[0].id,
        name: "Nasi Campur Ayam",
        code: "NCA001",
        brand: "Warung",
        variants: [
          {
            name: "Default",
            unitId: pcsUnit.id,
            quantity: 959,
            capitalPrice: 9000,
            price: 15000,
          },
        ],
      },
      {
        categoryId: categories[0].id,
        name: "Nasi Campur Telur",
        code: "NCT001",
        brand: "Warung",
        variants: [
          {
            name: "Default",
            unitId: pcsUnit.id,
            quantity: 971,
            capitalPrice: 7000,
            price: 12000,
          },
        ],
      },
      // Minuman
      {
        categoryId: categories[1].id,
        name: "Es Teh Manis",
        code: "ETM001",
        brand: "Minuman",
        variants: [
          {
            name: "Gelas",
            unitId: pcsUnit.id,
            quantity: 200,
            capitalPrice: 1000,
            price: 3000,
          },
        ],
      },
      {
        categoryId: categories[1].id,
        name: "Es Jeruk",
        code: "EJ001",
        brand: "Minuman",
        variants: [
          {
            name: "Gelas",
            unitId: pcsUnit.id,
            quantity: 150,
            capitalPrice: 1500,
            price: 4000,
          },
        ],
      },
      // Snack
      {
        categoryId: categories[2].id,
        name: "Pisang Keju Coklat",
        code: "PKC001",
        brand: "Snack",
        variants: [
          {
            name: "Default",
            unitId: pcsUnit.id,
            quantity: 50,
            capitalPrice: 8000,
            price: 12000,
          },
        ],
      },
      {
        categoryId: categories[2].id,
        name: "Kerupuk",
        code: "KRP001",
        brand: "Snack",
        variants: [
          {
            name: "Pak Kecil",
            unitId: pakUnit.id,
            quantity: 100,
            capitalPrice: 2000,
            price: 3500,
          },
        ],
      },
    ];

    for (const productData of products) {
      try {
        const product = await prisma.product.create({
          data: {
            storeId: activeStore.id,
            categoryId: productData.categoryId,
            name: productData.name,
            code: productData.code,
            brand: productData.brand,
            isActive: true,
            isFavorite: Math.random() > 0.7, // 30% chance to be favorite
          },
        });

        // Create variants
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

        console.log(`✅ Created product: ${product.name}`);
      } catch (error) {
        console.log(`⚠️ Product ${productData.name} might already exist`);
      }
    }
  }

  // 13. Seed Customers for Active Store
  if (activeStore) {
    console.log("👥 Seeding Customers...");

    const customers = [
      {
        name: "Budi Santoso",
        whatsapp: "081234567890",
        phone: "081234567890",
        address: "Jl. Mawar No. 123",
      },
      {
        name: "Siti Rahayu",
        whatsapp: "081234567891",
        phone: "081234567891",
        address: "Jl. Melati No. 456",
      },
      {
        name: "Ahmad Fauzi",
        whatsapp: "081234567892",
        phone: "081234567892",
        address: "Jl. Anggrek No. 789",
      },
    ];

    for (const customerData of customers) {
      try {
        await prisma.customer.create({
          data: {
            storeId: activeStore.id,
            ...customerData,
          },
        });
        console.log(`✅ Created customer: ${customerData.name}`);
      } catch (error) {
        console.log(`⚠️ Customer ${customerData.name} might already exist`);
      }
    }
  }

  // 14. Seed Sample Transactions
  if (activeStore) {
    console.log("🧾 Seeding Sample Transactions...");

    // Get products and customers for transactions
    const storeProducts = await prisma.product.findMany({
      where: { storeId: activeStore.id },
      include: {
        variants: { where: { isActive: true } },
      },
    });

    const storeCustomers = await prisma.customer.findMany({
      where: { storeId: activeStore.id },
    });

    // Sample transactions data
    const sampleTransactions = [
      // Transaksi 3 bulan lalu
      {
        date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        customer: storeCustomers[0],
        items: [
          {
            productName: "Nasi Pecel Ayam",
            variantName: "Porsi Normal",
            quantity: 2,
          },
          { productName: "Es Teh Manis", variantName: "Gelas", quantity: 2 },
        ],
      },
      // Transaksi 2 bulan lalu
      {
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        customer: storeCustomers[1],
        items: [
          {
            productName: "Nasi Campur Ayam",
            variantName: "Default",
            quantity: 1,
          },
          { productName: "Es Jeruk", variantName: "Gelas", quantity: 1 },
          { productName: "Kerupuk", variantName: "Pak Kecil", quantity: 1 },
        ],
      },
      // Transaksi bulan lalu
      {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        customer: null, // Walk-in customer
        items: [
          {
            productName: "Pisang Keju Coklat",
            variantName: "Default",
            quantity: 2,
          },
          { productName: "Es Teh Manis", variantName: "Gelas", quantity: 1 },
        ],
      },
      // Transaksi minggu lalu
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        customer: storeCustomers[2],
        items: [
          {
            productName: "Nasi Pecel Telur",
            variantName: "Default",
            quantity: 1,
          },
          {
            productName: "Nasi Campur Telur",
            variantName: "Default",
            quantity: 1,
          },
        ],
      },
      // Transaksi kemarin
      {
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        customer: storeCustomers[0],
        items: [
          {
            productName: "Nasi Pecel Ayam",
            variantName: "Porsi Jumbo",
            quantity: 1,
          },
          { productName: "Es Jeruk", variantName: "Gelas", quantity: 2 },
        ],
      },
      // Transaksi hari ini
      {
        date: new Date(),
        customer: null, // Walk-in customer
        items: [
          {
            productName: "Nasi Campur Ayam",
            variantName: "Default",
            quantity: 2,
          },
          { productName: "Es Teh Manis", variantName: "Gelas", quantity: 2 },
          { productName: "Kerupuk", variantName: "Pak Kecil", quantity: 1 },
        ],
      },
    ];

    let transactionCount = 0;
    for (const transactionData of sampleTransactions) {
      try {
        let subtotal = 0;
        const transactionItems = [];

        // Process items
        for (const itemData of transactionData.items) {
          const product = storeProducts.find(
            (p) => p.name === itemData.productName
          );
          if (!product || product.variants.length === 0) continue;

          const variant = product.variants.find(
            (v) => v.name === itemData.variantName
          );
          if (!variant) continue;

          const price = parseFloat(variant.price);
          const itemSubtotal = price * itemData.quantity;
          subtotal += itemSubtotal;

          transactionItems.push({
            productId: product.id,
            variantId: variant.id,
            name: `${product.name} - ${variant.name}`,
            quantity: itemData.quantity,
            price,
            discount: 0,
            subtotal: itemSubtotal,
          });
        }

        if (transactionItems.length === 0) continue;

        // Calculate tax and total
        const tax = subtotal * 0.1; // 10% tax
        const total = subtotal + tax;

        // Generate invoice number
        const invoiceNumber = `INV-TSJ-${Date.now()}-${transactionCount + 1}`;

        // Payment methods
        const paymentMethods = ["CASH", "TRANSFER", "EWALLET"];
        const paymentMethod =
          paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

        // Create transaction
        await prisma.transaction.create({
          data: {
            storeId: activeStore.id,
            userId: activeUser.id,
            customerId: transactionData.customer?.id,
            invoiceNumber,
            type: "SALE",
            status: "COMPLETED",
            subtotal,
            tax,
            discount: 0,
            total,
            paymentMethod,
            completedAt: transactionData.date,
            createdAt: transactionData.date,
            updatedAt: transactionData.date,
            items: {
              create: transactionItems,
            },
          },
        });

        transactionCount++;
        console.log(`✅ Created transaction: ${invoiceNumber}`);
      } catch (error) {
        console.log(`⚠️ Error creating transaction: ${error.message}`);
      }
    }

    console.log(`✅ Created ${transactionCount} sample transactions`);
  }

  // 15. Create sample payment records
  console.log("💳 Creating Sample Payments...");
  try {
    await prisma.payment.create({
      data: {
        userId: activeUser.id,
        subscriptionId: (
          await prisma.subscribe.findFirst({ where: { userId: activeUser.id } })
        )?.id,
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

  // 16. Summary
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
  console.log(`   Products: 8 products with variants`);
  console.log(`   Customers: 3 sample customers`);
  console.log(`   Transactions: Sample transactions for 3 months`);
  console.log("");
  console.log("👥 Member Account:");
  console.log(`   Email: member@test.com`);
  console.log(`   Password: MEMBER123`);
  console.log(`   Login Response: { type: "MEMBER", store: {...}, ... }`);
  console.log("");
  console.log("📊 LAPORAN FEATURES READY:");
  console.log("✅ Sales Report - Real-time, 1/6/12 months");
  console.log("✅ Stock Report - Current inventory status");
  console.log("✅ Dashboard Summary - Growth comparison");
  console.log("✅ Excel Download - Sales & Stock reports");
  console.log("✅ Top Selling Products analysis");
  console.log("✅ Daily sales data for charts");
  console.log("");
  console.log("🚀 SISTEM YANG READY:");
  console.log("✅ Universal login system");
  console.log("✅ New user promo (1 bulan bayar = 2 bulan akses)");
  console.log("✅ Email/password member invitation");
  console.log("✅ Subscription limits validation");
  console.log("✅ Admin panel untuk monitoring");
  console.log("✅ Payment integration dengan Duitku");
  console.log("✅ Report system with Excel export");
  console.log("");
  console.log("🎯 ADMIN FEATURES:");
  console.log("✅ View all active subscribers");
  console.log("✅ Change user subscription packages");
  console.log("✅ Extend subscription duration");
  console.log("✅ Delete user accounts");
  console.log("✅ Delete store members");
  console.log("✅ Dashboard statistics");
  console.log("");
  console.log("📈 REPORT API ENDPOINTS:");
  console.log("GET /api/reports/:storeId/sales?period=realtime|1|6|12");
  console.log("GET /api/reports/:storeId/stock?categoryId=optional");
  console.log("GET /api/reports/:storeId/dashboard");
  console.log("GET /api/reports/:storeId/sales/download");
  console.log("GET /api/reports/:storeId/stock/download");
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
