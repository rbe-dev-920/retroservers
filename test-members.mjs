import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const members = await prisma.members.findMany({
    select: { id: true, email: true, firstName: true, matricule: true, role: true }
  });
  console.log('Members in Prisma:');
  console.log(JSON.stringify(members, null, 2));
  process.exit(0);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
