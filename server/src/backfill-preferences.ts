import prisma from './utils/db';

async function main() {
  console.log('Starting NotificationPreference backfill...');
  const users = await prisma.user.findMany({
    include: {
      notificationPreference: true
    }
  });

  let backfilledCount = 0;
  for (const user of users) {
    if (!user.notificationPreference) {
      await prisma.notificationPreference.create({
        data: {
          userId: user.id
        }
      });
      backfilledCount++;
    }
  }

  console.log(`Backfilled ${backfilledCount} users with default NotificationPreferences.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
