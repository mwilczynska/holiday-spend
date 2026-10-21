import { Resend } from 'resend';
import { validateProductionConfig } from './lib/production-config.mjs';

try {
  validateProductionConfig(process.env);
  const args = process.argv.slice(2);
  const index = args.indexOf('--to');
  const to = index >= 0 ? args[index + 1] : undefined;
  if (!to || !(process.env.AUTH_ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).includes(to.toLowerCase())) {
    throw new Error('Supply --to with an address from AUTH_ADMIN_EMAILS.');
  }
  const message = {
    from: process.env.MAIL_FROM,
    to,
    subject: 'Holiday Spend email delivery test',
    text: 'Your Holiday Spend sending domain is verified. This message checks delivery of account emails. No action is required.\n\n' + process.env.APP_URL,
  };
  if (!args.includes('--send')) {
    console.log(JSON.stringify(message, null, 2));
    console.log('Preview only. Add --send after authorizing delivery.');
  } else {
    const response = await new Resend(process.env.RESEND_API_KEY).emails.send(message);
    if (response.error || !response.data?.id) throw new Error('Resend did not accept the email. Check its dashboard for provider details.');
    console.log('Email accepted by Resend. Confirm Delivered in the dashboard and receipt in the inbox.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Email check failed.');
  process.exitCode = 1;
}
