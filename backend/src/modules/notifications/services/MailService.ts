import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import nodemailer from 'nodemailer';
import {Invite} from '../classes/transformers/Invite.js';
import {InviteActionType, InviteStatusType} from '#shared/interfaces/models.js';
import { smtpConfig } from '#root/config/smtp.js';
import { appConfig } from '#root/config/app.js';

/**
 * Service for sending emails related to course invitations and notifications.
 *
 * @category Notifications/Services
 */
@injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass,
      },
    });
  }

  async sendMail(invite: Invite) {
    type MailContent = {
      subject: string;
      text: string;
      html: string;
    };
    

    const BASE_URL = appConfig.url || 'https://vibe.vicharanashala.ai';

    let mailContent: MailContent;

    switch (invite.action) {
      case InviteActionType.SIGNUP:
        mailContent = {
          subject: "You're Invited to Join a Course / SIGN UP",
          text: `You've been invited to join a course. Click: ${BASE_URL}/invites/accept?token=${invite.token}&courseId=${invite.courseId}&version=${invite.courseVersionId}`,
          html: `<p>You’ve been invited to join a course.</p>
                 <p><a href="${BASE_URL}/invites/accept?token=${invite.token}&courseId=${invite.courseId}&version=${invite.courseVersionId}">Accept Invitation</a></p>`,
        };
        break;

      case InviteActionType.NOTIFY:
        mailContent = {
          subject: 'Successfully Enrolled in the Course',
          text: `Your course has updates: ${BASE_URL}/courses/${invite.courseId}/notifications`,
          html: `<p>Your course has new updates.</p>
                 <p><a href="${BASE_URL}/courses/${invite.courseId}/notifications">View Notifications</a></p>`,
        };
        break;

      case InviteActionType.ENROLL:
        mailContent = {
          subject: "You're Invited to Join a Course" ,
          text: `You've been enrolled. Start here: ${BASE_URL}/courses/${invite.courseId}/enroll?token=${invite.token}`,
          html: `<p>You’ve been enrolled in <b>${invite.courseId}</b>.</p>
                 <p><a href="${BASE_URL}/courses/${invite.courseId}/enroll?token=${invite.token}">Start Learning</a></p>`,
        };
        break;

      default:
        throw new Error(`Unknown action: ${invite.action}`);
    }

    const mailOptions = {
      from: smtpConfig.auth.user,
      to: invite.email,
      subject: mailContent.subject,
      text: mailContent.text,
      html: mailContent.html,
    };
    

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      return info;
    } catch (error) {
      
      throw error;
    }
  }
}
