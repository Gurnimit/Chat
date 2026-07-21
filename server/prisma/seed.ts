import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.messageReaction.deleteMany();
  await prisma.messageRead.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.session.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // Create users
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      username: 'alice',
      publicId: 'VC-E9D9HD8B',
      passwordHash,
      isEmailVerified: true,
      profile: {
        create: {
          displayName: 'Alice Smith',
          bio: 'Building things with React and TypeScript.',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          isOnline: true,
        },
      },
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      username: 'bob',
      publicId: 'VC-4U8J3FB1',
      passwordHash,
      isEmailVerified: true,
      profile: {
        create: {
          displayName: 'Bob Johnson',
          bio: 'Express and Postgres specialist.',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          isOnline: false,
          lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
        },
      },
    },
  });

  const charlie = await prisma.user.create({
    data: {
      email: 'charlie@example.com',
      username: 'charlie',
      publicId: 'VC-1H4VJVU2',
      passwordHash,
      isEmailVerified: true,
      profile: {
        create: {
          displayName: 'Charlie Brown',
          bio: 'Mobile dev & UX enthusiast.',
          avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
          isOnline: true,
        },
      },
    },
  });

  console.log('Test users created successfully:');
  console.log(`- Alice: alice@example.com / password123`);
  console.log(`- Bob: bob@example.com / password123`);
  console.log(`- Charlie: charlie@example.com / password123`);

  console.log('Seed database creation complete! (Fresh installation mode - no conversations created)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
