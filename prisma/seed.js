import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Units...');
  
  // Seed units
  const units = await prisma.unit.createMany({
    data: [
      { name: "PCS" },
      { name: "KTN" },
      { name: "DUS" },
      { name: "PAK" },
      { name: "BAL" },
      { name: "LAINNYA" }
    ],
    skipDuplicates: true
  });

  console.log(`✅ Created ${units.count} units successfully`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });