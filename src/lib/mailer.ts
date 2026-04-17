import { Resend } from 'resend';

const isProduction = process.env.NODE_ENV === 'production';
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const mailFrom = process.env.MAIL_FROM?.trim();

function getBaseUrl() {
  return process.env.APP_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
}

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  devLogLabel: string;
}) {
  if (!isMailConfigured()) {
    if (isProduction) {
      throw new Error(
        'RESEND_API_KEY and MAIL_FROM are required in production for native auth email delivery.'
      );
    }

    console.log(`[auth] ${options.devLogLabel} for ${options.to}`);
    console.log(options.text);
    return;
  }

  const resend = new Resend(resendApiKey);
  const response = await resend.emails.send({
    from: mailFrom!,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (response.error) {
    throw new Error(`Failed to send email via Resend: ${response.error.message}`);
  }
}

export function isMailConfigured() {
  return Boolean(resendApiKey && mailFrom);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const subject = 'Verify your Wanderledger email';
  const text = [
    'Verify your Wanderledger email address.',
    '',
    `Open this link to finish setting up your account: ${verifyUrl}`,
    '',
    'This link expires in 24 hours.',
    '',
    `If the button does not work, copy and paste this URL into your browser: ${verifyUrl}`,
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Verify your Wanderledger email</h1>
      <p>Finish setting up your account by opening the link below.</p>
      <p style="margin: 24px 0;">
        <a
          href="${verifyUrl}"
          style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;"
        >
          Verify email
        </a>
      </p>
      <p>This link expires in 24 hours.</p>
      <p style="font-size: 14px; color: #4b5563;">
        If the button does not work, copy and paste this URL into your browser:<br />
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject,
    html,
    text,
    devLogLabel: `verification link (${getBaseUrl()})`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Reset your Wanderledger password';
  const text = [
    'Reset your Wanderledger password.',
    '',
    `Open this link to set a new password: ${resetUrl}`,
    '',
    'This link expires in 30 minutes.',
    '',
    `If the button does not work, copy and paste this URL into your browser: ${resetUrl}`,
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your Wanderledger password</h1>
      <p>Open the link below to choose a new password for your account.</p>
      <p style="margin: 24px 0;">
        <a
          href="${resetUrl}"
          style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;"
        >
          Reset password
        </a>
      </p>
      <p>This link expires in 30 minutes.</p>
      <p style="font-size: 14px; color: #4b5563;">
        If the button does not work, copy and paste this URL into your browser:<br />
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject,
    html,
    text,
    devLogLabel: `password reset link (${getBaseUrl()})`,
  });
}
