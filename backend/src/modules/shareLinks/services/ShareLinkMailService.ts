import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import nodemailer from 'nodemailer';
import {MailService} from '#root/modules/notifications/services/MailService.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {IShareLink, ShareLinkViewingMode} from '#shared/interfaces/models.js';

/**
 * Mails a share link to the person it was issued to.
 *
 * The link is personal — it carries their identity — so it is never sent to
 * more than one address, and never CC'd.
 *
 * @category ShareLinks/Services
 */
@injectable()
export class ShareLinkMailService {
  constructor(
    @inject(NOTIFICATIONS_TYPES.MailService)
    private readonly mailService: MailService,
  ) {}

  /**
   * @returns true when the mail was handed to the transport, false when it
   *          failed — a failed send must not sink the whole share, since the
   *          sharer can still copy the link.
   */
  async sendShareLink(
    link: IShareLink,
    url: string,
    subjectTitle: string,
  ): Promise<boolean> {
    try {
      await this.mailService.sendMail(this.buildMessage(link, url, subjectTitle));
      return true;
    } catch (error) {
      console.error(
        `Failed to email share link ${link._id?.toString()}:`,
        error,
      );
      return false;
    }
  }

  buildMessage(
    link: IShareLink,
    url: string,
    subjectTitle: string,
  ): Omit<nodemailer.SendMailOptions, 'from'> {
    const proctored = link.viewingMode === ShareLinkViewingMode.PROCTORED;
    const expiry = link.expiresAt
      ? new Date(link.expiresAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    const proctoringNote = proctored
      ? 'This video is proctored: your camera and microphone are used while '
        + 'you watch, and the video may roll back if the system detects an '
        + 'issue. Please allow access when prompted.'
      : 'Just click and watch — no account, no sign-up.';

    const text =
      `Hello ${link.recipientName},\n\n`
      + `You have been sent a video to watch on ViBe.\n\n`
      + `${subjectTitle}\n\n`
      + `Watch it here:\n${url}\n\n`
      + `${proctoringNote}\n\n`
      + (expiry ? `This link works until ${expiry}.\n` : '')
      + `The link is personal to you, so please do not forward it — anything `
      + `watched through it is recorded against your name.\n\n`
      + `Best regards,\nTeam ViBe`;

    return {
      to: link.recipientEmail,
      subject: `A video for you: ${subjectTitle}`,
      text,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>A video for you</title></head>
<body style="margin:0; padding:0; background-color:#f6f6f6;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
               style="border-collapse:collapse; border-radius:8px; overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 24px;">
              <img src="https://continuousactivelearning.github.io/vibe/img/logo.png"
                   alt="ViBe" width="120" style="display:block; border:0;">
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial, sans-serif; font-size:16px; line-height:1.6; padding:0 24px 8px;">
              <p style="margin:0 0 16px;">Hello ${link.recipientName},</p>
              <p style="margin:0 0 16px;">
                You have been sent a video to watch on ViBe —
                <strong style="color:#ff9800;">${subjectTitle}</strong>.
              </p>
              <p style="margin:0 0 16px;">${proctoringNote}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 24px 24px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ff9800" style="border-radius:6px; padding:16px 40px; text-align:center;">
                    <a href="${url}"
                       style="font-family:Arial, sans-serif; font-size:18px; font-weight:bold; color:#ffffff; text-decoration:none; display:inline-block;">
                      Watch the video
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial, sans-serif; font-size:13px; line-height:1.6; color:#666666; padding:0 24px 24px;">
              ${expiry ? `<p style="margin:0 0 8px;">This link works until ${expiry}.</p>` : ''}
              <p style="margin:0 0 8px;">
                The link is personal to you, so please do not forward it —
                anything watched through it is recorded against your name.
              </p>
              <p style="margin:0;">Best regards,<br>Team ViBe</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };
  }
}
