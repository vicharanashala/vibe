import 'reflect-metadata';
import { injectable } from 'inversify';
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
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
    const transportOptions: SMTPTransport.Options = smtpConfig.host
      ? {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.auth.user,
            pass: smtpConfig.auth.pass,
          },
        }
      : {
          service: smtpConfig.service,
          auth: {
            user: smtpConfig.auth.user,
            pass: smtpConfig.auth.pass,
          },
        };

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  async sendMail(options: Omit<nodemailer.SendMailOptions, 'from'>): Promise<nodemailer.SentMessageInfo> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfig.from,
      ...options,
    };

    return await this.transporter.sendMail(mailOptions);
  }
}
