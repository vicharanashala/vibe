import 'reflect-metadata';
import { injectable } from 'inversify';
import nodemailer from 'nodemailer';
import { smtpConfig } from '#root/config/smtp.js';

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

  async sendMail(options: Omit<nodemailer.SendMailOptions, 'from'>): Promise<nodemailer.SentMessageInfo> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfig.auth.user,
      ...options
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }
}
