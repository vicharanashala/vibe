import 'reflect-metadata';
import { injectable } from 'inversify';
import nodemailer from 'nodemailer';
import { smtpConfig } from '#root/config/smtp.js';

/** The values config falls back to when SMTP is not configured at all. */
const PLACEHOLDER_USER = 'user@example.com';
const PLACEHOLDER_PASS = 'password';

/**
 * Service for sending emails related to course invitations and notifications.
 *
 * @category Notifications/Services
 */
@injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass,
      },
    });
  }

  /** True when real credentials are configured, rather than the fallbacks. */
  private isConfigured(): boolean {
    return (
      !!smtpConfig.auth.user &&
      !!smtpConfig.auth.pass &&
      smtpConfig.auth.user !== PLACEHOLDER_USER &&
      smtpConfig.auth.pass !== PLACEHOLDER_PASS
    );
  }

  /**
   * Sends a message, and throws if it could not be sent.
   *
   * This used to return `true` without sending anything, which meant every
   * caller — invites included — recorded a success for mail that never left
   * the server. Failing loudly is what lets callers mark a send as failed and
   * tell someone about it.
   */
  async sendMail(
    options: Omit<nodemailer.SendMailOptions, 'from'>,
  ): Promise<nodemailer.SentMessageInfo> {
    if (!this.isConfigured()) {
      throw new Error(
        'SMTP is not configured. Set SMTP_USER and SMTP_PASS to send mail.',
      );
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfig.auth.user,
      ...options,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
