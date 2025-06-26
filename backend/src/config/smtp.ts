import {env} from '#root/utils/env.js';

export const smtpConfig = {
  auth: {
    user: env('SMTP_USER') || 'user@example.com',
    pass: env('SMTP_PASS') || 'password',
  }
};
