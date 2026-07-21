import crypto from 'crypto';
import prisma from './db';

const PUBLIC_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a random alphanumeric string with the VC- prefix.
 */
export function generatePublicIdRaw(): string {
  let result = 'VC-';
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, PUBLIC_ID_CHARS.length);
    result += PUBLIC_ID_CHARS.charAt(idx);
  }
  return result;
}

/**
 * Generates a verified unique publicId by checking collision against the database.
 */
export async function generateUniquePublicId(): Promise<string> {
  let publicId = generatePublicIdRaw();
  let unique = false;
  let attempts = 0;

  while (!unique && attempts < 20) {
    const existing = await prisma.user.findUnique({
      where: { publicId }
    });
    if (!existing) {
      unique = true;
    } else {
      publicId = generatePublicIdRaw();
      attempts++;
    }
  }

  return publicId;
}
