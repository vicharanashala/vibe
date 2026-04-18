import 'reflect-metadata';
import { BadRequestError, InternalServerError, NotFoundError } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { CourseRepository } from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';
import { InviteRepository } from '#shared/database/providers/mongo/repositories/InviteRepository.js';
import { MailService } from './MailService.js';
import { Invite } from '../classes/transformers/Invite.js';
import { EnrollmentRole, ICourseVersion, ICourse } from '#shared/interfaces/models.js';
import { NOTIFICATIONS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { appConfig } from '#root/config/app.js';
import nodemailer from 'nodemailer';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { InviteResult } from '../classes/index.js';
import { BaseService, MongoDatabase } from '#root/shared/index.js';


@injectable()
export class InviteService extends BaseService {
  constructor(
    @inject(NOTIFICATIONS_TYPES.InviteRepo) private readonly inviteRepo: InviteRepository,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: UserRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: CourseRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(NOTIFICATIONS_TYPES.MailService)
    private readonly mailService: MailService,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase
  ) {
    super(database);
  }

  private createInviteEmailMessage(invite: Invite, course: ICourse, courseVersion: ICourseVersion): Omit<nodemailer.SendMailOptions, 'from'> {
    return {
      to: invite.email,
      subject: `Invitation to join course: ${course.name}`,
      text:
        `Dear Participant,\n\n` +
        `We are pleased to invite you to participate in your upcoming online course - ${course.name}, delivered via our Continuous Active Learning Platform, ViBe.\n\n` +
        `Before you begin, please carefully read and follow the instructions below to ensure a smooth and compliant experience:\n` +
        `- Speaking is strictly prohibited. If the system detects speaking, there is zero tolerance, and the video will immediately roll back to the start, pausing with an alert dialog.\n` +
        `- Ensure your camera remains uninterrupted. Any camera interruptions will be detected and may result in penalty score increases and video rollback.\n` +
        `- Do not use a blurred background. The AI proctoring system tracks background clarity. A blurred background may trigger penalties and video rollback.\n` +
        `- No other person should appear near you during the session. The system monitors for additional individuals in the camera’s view. Detection of more than one person leads to immediate video rollback and a pause until the area is clear.\n` +
        `- Allow microphone access. The system needs mic access to detect speaking, which is strictly prohibited and may result in penalties and video rollback.\n\n` +
        `By following these rules, you help maintain the integrity and fairness of the course environment.\n\n` +
        `To confirm your participation, please click the link below:\n${appConfig.url}${appConfig.routePrefix}/notifications/invite/${invite._id.toString()}\n\n` +
        `We wish you a successful learning experience!\nBest regards,\nTechnical Team, CBPAI, IIT Ropar`,
      html:
        `<!DOCTYPE html>
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
  <title>Course Invitation</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f6f6;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
               style="border-collapse:collapse; border-radius:8px; overflow:hidden;">
          
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding:32px 24px;">
              <img src="https://continuousactivelearning.github.io/vibe/img/logo.png"
                   alt="ViBe Logo" width="120" style="display:block; border:0;">
            </td>
          </tr>

          <!-- Intro greeting -->
          <tr>
            <td style="font-family:Arial, sans-serif; font-size:16px; line-height:1.6; padding:0 24px 24px;">
              <p style="margin:0 0 16px;">
                Dear Participant,
              </p>
              <p style="margin:0 0 16px;">
                We are pleased to invite you to participate in your upcoming online course – 
                <strong style="color:#ff9800;">${course.name}</strong>,
                delivered via our Continuous Active Learning Platform, ViBe.
              </p>
              <p style="margin:0 0 16px;">
                Before you begin, please carefully read and follow the instructions below to ensure a smooth and compliant experience:
              </p>
            </td>
          </tr>

          <!-- Instruction list -->
          <tr>
            <td style="padding:0 24px 24px;">
              <ul style="font-family:Arial, sans-serif; font-size:14px; line-height:1.6; margin:0; padding-left:16px;">
                <li><strong style="color:#ff9800;">Speaking is strictly prohibited.</strong> If the system detects speaking, there is zero tolerance, and the video will immediately roll back to the start, pausing with an alert dialog..</li>
                <li><strong style="color:#ff9800;">Ensure your camera remains uninterrupted.</strong> Any camera interruptions will be detected and may result in penalty score increases and video rollback.</li>
                <li><strong style="color:#ff9800;">Do not use a blurred background.</strong> The AI proctoring system tracks background clarity. A blurred background may trigger penalties and video rollback.</li>
                <li><strong style="color:#ff9800;">No other person should appear near you during the session.</strong> The system monitors for additional individuals in the camera’s view. Detection of more than one person leads to immediate video rollback and a pause until the area is clear.</li>
                <li><strong style="color:#ff9800;">Allow microphone access.</strong> The system needs mic access to detect speaking, which is strictly prohibited and may result in penalties and video rollback.</li>
              </ul>
            </td>
          </tr>

          <!-- Integrity & CTA -->
          <tr>
            <td style="padding:0 24px;">
              <p style="margin:0 0 24px; font-family:Arial, sans-serif; font-size:14px; line-height:1.6;">
                By following these rules, you help maintain the integrity and fairness of the course environment.&nbsp;
              </p>
              <!--[if gte mso 9]><br><![endif]-->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#ff9800" style="border-radius:6px; padding:16px 40px; text-align:center;">
                          <a href="${appConfig.url}${appConfig.routePrefix}/notifications/invite/${invite._id.toString()}"
                             style="font-family:Arial, sans-serif; font-size:20px; font-weight:bold; color:#ffffff; text-decoration:none; display:inline-block;">
                            Accept Invite
                          </a>
                        </td>
                      </tr>
                  </td>
                </tr>
                <p style="margin:0 24px; padding-bottom:24px; font-family:Arial, sans-serif; font-size:13px; line-height:1.6;">
                  We wish you a successful learning experience!<br>
                  Best regards,<br>
                  Technical Team, CBPAI, IIT Ropar&nbsp;
                </p>
                <!--[if gte mso 9]><br><![endif]-->
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
    };
  }

  async inviteUserToCourse(
    inviteData: { email: string; role: EnrollmentRole }[],
    courseId: string,
    courseVersionId: string
  ): Promise<InviteResult[]> {

    return this._withTransaction(async (session) => {
      // Get Course Details
      const course = await this.courseRepo.read(courseId.toString());
      if (!course) {
        throw new NotFoundError('Course not found');
      }
      // Get Course Version Details
      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId.toString()
      );
      if (!courseVersion) {
        throw new NotFoundError('Course version not found');
      }

      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // Create Invites
      const inviteIds = await Promise.all(
        inviteData.map(async ({ email, role }) => {

          // Check if already invited
          const user = await this.userRepo.findByEmail(email);
          const isNewUser = !user;

          const isAlreadyEnrolled = user
            ? !!(await this.enrollmentRepo.findEnrollment(
              user._id.toString(),
              courseId,
              courseVersionId
            ))
            : false;

          const invite = new Invite(
            email,
            courseId,
            courseVersionId,
            role,
            isAlreadyEnrolled,
            isNewUser,
            oneWeekFromNow
          );
          return this.inviteRepo.create(invite, session);
        })
      );
      // Get Invite Details
      const invites = await this.inviteRepo.findInvitesByIds(inviteIds, session);
      // Prepare and send emails
      await Promise.all(invites.map(async (invite) => {
        const emailMessage = await this.createInviteEmailMessage(invite, course, courseVersion);
        try {
          await this.mailService.sendMail(emailMessage);
        } catch (error) {
          // Update Status to EMAIL_FAILED
          invite.inviteStatus = 'EMAIL_FAILED';
          await this.inviteRepo.updateInvite(invite._id.toString(), invite);
          return;
        }
      }));

      // Return invite details
      const inviteDetails = invites.map((invite) => {
        return new InviteResult(invite._id, invite.email, invite.inviteStatus, invite.role);
      });
      return inviteDetails;
    });

  }

  async processInvite(inviteId: string): Promise<{ message: string }> {

    const invite = await this.inviteRepo.findInviteById(inviteId);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.inviteStatus === 'CANCELLED') {
      return {
        message: 'This invite has been cancelled.',
      }
    }

    if (invite.inviteStatus === 'ACCEPTED') {
      return {
        message: 'You have already accepted this invite.',
      };
    }
    const date = new Date();
    // Validate the invite expiresAt < new Date() throw error
    // if (invite.expiresAt < date) {
    //   throw new BadRequestError('Invite has expired');
    // }
    // If enrolled, return
    if (invite.isAlreadyEnrolled) {
      return {
        message: 'You are already enrolled in this course.',
      };
    }

    // Update invite status to ACCEPTED
    invite.inviteStatus = 'ACCEPTED';
    invite.acceptedAt = date;
    await this.inviteRepo.updateInvite(inviteId, invite);

    // If existing user, enroll them
    if (!invite.isNewUser && !invite.isAlreadyEnrolled) {
      const user = await this.userRepo.findByEmail(invite.email);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      // Enroll user in course
      const result = await this.enrollmentService.enrollUser(user._id.toString(), invite.courseId, invite.courseVersionId, invite.role, true);
      if (!result) {
        throw new InternalServerError('Failed to enroll user in course');
      }
      if (result == 'ALREADY_ENROLLED') {
        return {
          message: 'You are already enrolled in this course.',
        };
      }
      return {
        message: `You have been successfully enrolled in the course as ${result.role}.`,
      };
    }

    // If new user, message that their invite acceptance as has been acknowledged please sign up
    if (invite.isNewUser) {
      return {
        message: 'Your invite acceptance has been acknowledged. Please sign up to access the course.',
      };
    }
  }

  async cancelInvite(inviteId: string): Promise<{ message: string }> {
    const invite = await this.inviteRepo.findInviteById(inviteId);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    // Update invite status to CANCELLED
    invite.inviteStatus = 'CANCELLED';
    await this.inviteRepo.updateInvite(inviteId, invite);

    return { message: 'Invite has been cancelled successfully.' };
  }

  async resendInvite(inviteId: string): Promise<{ message: string }> {
    const invite = await this.inviteRepo.findInviteById(inviteId);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    // Validate the invite expiresAt < new Date() throw error
    if (invite.expiresAt < new Date()) {
      throw new BadRequestError('Invite has expired');
    }

    // Prepare and send email
    const course = await this.courseRepo.read(invite.courseId.toString());
    const courseVersion = await this.courseRepo.readVersion(invite.courseVersionId.toString());
    if (!course || !courseVersion) {
      throw new NotFoundError('Course or Course Version not found');
    }

    const emailMessage = this.createInviteEmailMessage(invite, course, courseVersion);

    try {
      await this.mailService.sendMail(emailMessage);
      return { message: 'Invite resent successfully.' };
    } catch (error) {
      throw new InternalServerError('Failed to resend invite email');
    }
  }

  async findInvitesForCourse(
    courseId: string,
    courseVersionId: string
  ): Promise<InviteResult[]> {
    const course = await this.courseRepo.read(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }

    const invites = await this.inviteRepo.findInvitesByCourse(courseId, courseVersionId);
    return invites.map(invite => {
      return new InviteResult(
        invite._id,
        invite.email,
        invite.inviteStatus,
        invite.role,
        invite.acceptedAt
      );
    });
  }

  async findInvitesByEmail(email: string): Promise<InviteResult[]> {
    const invites = await this.inviteRepo.findInvitesByEmail(email);
    return invites.map(invite => {
      return new InviteResult(
        invite._id,
        invite.email,
        invite.inviteStatus,
        invite.role,
        invite.acceptedAt
      );
    });
  }

  async findInvitesByUserId(userId: string): Promise<InviteResult[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const invites = await this.inviteRepo.findInvitesByEmail(user.email);

    const invitesWithCourse = await Promise.all(invites.map(async (invite) => {
      const course = await this.courseRepo.read(invite.courseId);

      return new InviteResult(
        invite._id,
        invite.email,
        invite.inviteStatus,
        invite.role,
        invite.acceptedAt,
        invite.courseId,
        invite.courseVersionId,
        course
      );
    }));

    return invitesWithCourse;
  }

  async findInviteById(inviteId: string): Promise<InviteResult> {
    const invite = await this.inviteRepo.findInviteById(inviteId);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }
    return new InviteResult(
      invite._id,
      invite.email,
      invite.inviteStatus,
      invite.role,
      invite.acceptedAt,
      invite.courseId,
      invite.courseVersionId
    );
  }
}