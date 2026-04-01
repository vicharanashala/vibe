import {env} from '#root/utils/env.js';

export const smtpConfig = {
  service: env('SMTP_SERVICE') || 'gmail',
  host: env('SMTP_HOST') || undefined,
  port: Number(env('SMTP_PORT') || 587),
  secure: env('SMTP_SECURE') === 'true',
  auth: {
    user: env('SMTP_USER') || 'user@example.com',
    pass: env('SMTP_PASS') || 'password',
  },
  from: env('SMTP_FROM') || env('SMTP_USER') || 'user@example.com',
};
