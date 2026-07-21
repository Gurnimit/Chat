import prisma from './utils/db';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      publicId: true
    }
  });
  console.log('--- Users ---');
  console.log(users);

  const logs = await prisma.callLog.findMany();
  console.log('--- Call Logs ---');
  console.log(logs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
