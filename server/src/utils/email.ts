/**
 * Email delivery module.
 *
 * Currently logs to console (no email service configured).
 * To enable real email delivery, replace the console.log in sendEmail()
 * with a call to your email provider (SendGrid, AWS SES, Nodemailer/SMTP, etc.).
 *
 * Usage in auth.routes.ts:
 *   import { sendEmail } from '../utils/email';
 *   await sendEmail(user.email, 'Verify your email', `Your verification link: ${link}`);
 */

import { logger } from './logger';

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  logger.info(`[Email] To: ${to}`);
  logger.info(`[Email] Subject: ${subject}`);
  logger.info(`[Email] Body: ${body}`);
  logger.info('[Email] (No email provider configured — logged to console only)');
}
