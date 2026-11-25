import 'reflect-metadata';
import nodemailer from 'nodemailer';

/**
 * Builds the text and HTML content for a spaced-repetition review reminder email.
 *
 * @category Notifications/Transformers
 */
export class ReviewReminderEmail {
  /**
   * Creates a nodemailer-compatible email payload for a review reminder.
   *
   * @param params.studentEmail      — recipient email address
   * @param params.studentName       — optional first name for personalisation
   * @param params.dueCount          — total number of items due
   * @param params.courseNames       — display names of courses with due items (first 3)
   * @param params.totalCourseCount  — total courses with due items
   * @param params.ctaUrl            — optional deep-link to the review dashboard
   */
  static createMessage(params: {
    studentEmail: string;
    studentName?: string;
    dueCount: number;
    courseNames: string[];
    totalCourseCount: number;
    ctaUrl?: string;
  }): Omit<nodemailer.SendMailOptions, 'from'> {
    const { studentEmail, studentName, dueCount, courseNames, totalCourseCount, ctaUrl } = params;

    const itemLabel = dueCount === 1 ? 'question' : 'questions';
    const courseLabel = totalCourseCount === 1 ? '1 course' : `${totalCourseCount} courses`;
    const greeting = studentName ? `Hi ${studentName},` : 'Hi there,';
    const courseList =
      courseNames.length < totalCourseCount
        ? courseNames.join(', ') + ` and ${totalCourseCount - courseNames.length} more`
        : courseNames.join(', ');

    const text = [
      `You have ${dueCount} ${itemLabel} due for review across ${courseLabel}: ${courseList}.`,
      '',
      'Regular review is the most effective way to retain what you have learned.',
      ctaUrl ? `Start your review session now: ${ctaUrl}` : 'Log in to ViBe to start your review session.',
      '',
      "You're receiving this because you have spaced repetition reminders enabled.",
      'Manage your notification preferences in your ViBe profile.',
    ].join('\n');

    const ctaHtml = ctaUrl
      ? `<tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ff9800" style="border-radius:6px; padding:16px 40px; text-align:center;">
                    <a href="${ctaUrl}"
                       style="font-family:Arial, sans-serif; font-size:18px; font-weight:bold; color:#ffffff; text-decoration:none; display:inline-block;">
                      Start Review Session
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if (gte mso 9)|(IE)]>
  <style type="text/css">
    table { border-collapse:collapse; border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    td, p { mso-line-height-rule:exactly; }
  </style>
  <![endif]-->
  <title>Time to Review</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f6f6;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
               style="border-collapse:collapse; border-radius:8px; overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:32px 24px 24px;">
              <img src="https://continuousactivelearning.github.io/vibe/img/logo.png"
                   alt="ViBe Logo" width="120" style="display:block; border:0;">
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding:0 24px 8px;">
              <h1 style="margin:0; font-family:Arial, sans-serif; font-size:24px; font-weight:bold; color:#222222; text-align:center;">
                📝 Time for a memory refresh
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 24px 24px; font-family:Arial, sans-serif; font-size:16px; line-height:1.6; color:#444444;">

              <p style="margin:0 0 16px;">
                ${greeting}
              </p>

              <p style="margin:0 0 16px;">
                You have
                <strong style="color:#ff9800;">${dueCount} ${itemLabel}</strong>
                due for review across
                <strong style="color:#ff9800;">${courseLabel}</strong>:
              </p>

              <p style="margin:0 0 24px; padding-left:16px;">
                ${courseNames.map(name => `• ${name}`).join('<br>')}
                ${courseNames.length < totalCourseCount ? `<br>• and ${totalCourseCount - courseNames.length} more` : ''}
              </p>

              <p style="margin:0 0 24px;">
                Regular review is the most effective way to retain what you have learned.
                Just a few minutes today saves hours of cramming later.
              </p>

            </td>
          </tr>

          <!-- CTA button -->
          ${ctaHtml}

          <!-- Footer -->
          <tr>
            <td style="padding:0 24px 24px; font-family:Arial, sans-serif; font-size:13px; line-height:1.6; color:#888888; text-align:center;">
              <p style="margin:0 0 8px;">
                You're receiving this because you have spaced repetition reminders enabled.
              </p>
              <p style="margin:0;">
                Manage your notification preferences in your ViBe profile.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
      to: studentEmail,
      subject: `📝 Time to review — ${dueCount} ${itemLabel} waiting`,
      text,
      html,
    };
  }
}