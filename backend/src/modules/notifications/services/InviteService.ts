import 'reflect-metadata';
import { BadRequestError, InternalServerError, NotFoundError } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { CourseRepository } from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';
import { InviteRepository } from '#shared/database/providers/mongo/repositories/InviteRepository.js';
import { MailService } from './MailService.js';
import { Invite } from '../classes/transformers/Invite.js';
import crypto from 'crypto';
import { InviteActionType, InviteStatusType, IEnrollment, EnrollmentRole, ICourseVersion, ICourse } from '#shared/interfaces/models.js';
import { plainToClass, instanceToPlain } from 'class-transformer';
import { NOTIFICATIONS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { User } from '#auth/classes/transformers/User.js';
import { STATUS_CODES } from 'http';
import { smtpConfig } from '#root/config/smtp.js';
import { appConfig } from '#root/config/app.js';
import nodemailer from 'nodemailer';
import { I } from 'vitest/dist/chunks/reporters.d.DL9pg5DB.js';
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
      text: `You have been invited to join the course ${course.name} as ${invite.role}. Click the link to accept the invite: ${appConfig.url}/notifications/invite/${invite._id.toString()}`,
      html: `<p>You have been invited to join the course ${course.name} as ${invite.role}. Click the link to accept the invite:</p>
             <a href="${appConfig.url}/notifications/invite/${invite._id.toString()}">Accept Invite</a>`,
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

    if(invite.inviteStatus === 'CANCELLED'){
      return {
        message: 'This invite has been cancelled.',
      }
    }

    if(invite.inviteStatus === 'ACCEPTED') {
      return {
        message: 'You have already accepted this invite.',
      };
    }

    // Validate the invite expiresAt < new Date() throw error
    if (invite.expiresAt < new Date()) {
      throw new BadRequestError('Invite has expired');
    }
    // If enrolled, return
    if (invite.isAlreadyEnrolled) {
      return {
        message: 'You are already enrolled in this course.',
      };
    }

    // Update invite status to ACCEPTED
    invite.inviteStatus = 'ACCEPTED';
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
      if(result == 'ALREADY_ENROLLED') {
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
        invite.role
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
        invite.role
      );
    });
  }

  async findInvitesByUserId(userId: string): Promise<InviteResult[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const invites = await this.inviteRepo.findInvitesByEmail(user.email);
    return invites.map(invite => {
      return new InviteResult(
        invite._id,
        invite.email,
        invite.inviteStatus,
        invite.role
      );
    });
  }
}
