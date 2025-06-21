import 'reflect-metadata';
import {NotFoundError} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {CourseRepository} from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import {UserRepository} from '#shared/database/providers/mongo/repositories/UserRepository.js';
import {InviteRepository} from '#shared/database/providers/mongo/repositories/InviteRepository.js';
import { MailService } from './MailService.js';
import {Invite} from '../classes/transformers/Invite.js';
import crypto from 'crypto';
import {InviteActionType, InviteStatusType, IEnrollment} from '#shared/interfaces/models.js';
import {plainToClass, instanceToPlain} from 'class-transformer';
import { NOTIFICATIONS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { User } from '#auth/classes/transformers/User.js';
import { STATUS_CODES } from 'http';
import { InviteProResponse } from '../classes/index.js';


@injectable()
export class InviteService {
  constructor(
    @inject(NOTIFICATIONS_TYPES.InviteRepo) private readonly inviteRepo: InviteRepository,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: UserRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: CourseRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(NOTIFICATIONS_TYPES.MailService)
    private readonly mailService: MailService,
  ) {}
  /**
   * Invites multiple users to a specific version of a course.
   *
   * @param emails - List of user emails to invite.
   * @param courseId - The ID of the course.
   * @param courseVersionId - The ID of the course version.
   * @returns A promise that resolves to an array of results for each email.
   */
  async inviteUserToCourse(
    emails: string[],
    courseId: string,
    courseVersionId: string,
  ) {
    const results = [];
    for (const email of emails) {
      // Prepare the invite object
      const result = {
        email: email,
        status: 'pending',
        message: "",
        action: "",
      }
  
      const inviteObject = plainToClass(Invite, {
        email: email,
        courseId: courseId, // Must be a valid MongoDB ObjectId string
        courseVersionId: courseVersionId,
        token: 'secure-random-token-abc123',
        action: InviteActionType.SIGNUP, // enum usage
        status: InviteStatusType.PENDING, // enum usage
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });
      let user = null;
      try {
        user = await this.userRepo.findByEmail(inviteObject.email);
        result.status = 'User exists in platform';
        
        const enrollment = await this.enrollmentRepo.findEnrollment(
          user._id.toString(),
          inviteObject.courseId,
          inviteObject.courseVersionId,
        );
        if (enrollment) {
          inviteObject.action = InviteActionType.NOTIFY;
          inviteObject.status = InviteStatusType.ACCEPTED;
          result.status = 'already_enrolled';
          result.action = "notify";
          result.message = "User already enrolled in this course";
          
        } else {
          inviteObject.action = InviteActionType.ENROLL;
          inviteObject.status = InviteStatusType.PENDING;
          result.status = 'pending';
          result.action = "enroll";
          result.message = "User not enrolled in course"
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        inviteObject.action = InviteActionType.SIGNUP;
        inviteObject.status = InviteStatusType.PENDING;
        result.status = 'pending';
        result.message = "User not found, signup required";
        result.action = "signup";
      }
    
      const invitePlain = instanceToPlain(inviteObject);
      try {
        const res = await this.inviteRepo.create(invitePlain);
        
        inviteObject.token = res.insertedId.toString();

      } catch (error) {
        
        throw error;
      }
      try{
        await this.mailService.sendMail(inviteObject);
        results.push(result);
      } catch (error) {
        
        result.status = 'error';
        result.message = 'Failed to send invite email';
      }
    }
    return results;
  }

  

  async processInvite(token: string): Promise<any> {
    const invite = await this.inviteRepo.findInviteByToken(token);
   

    // Step 1: Validate invite
    if (!invite || invite.status !== InviteStatusType.PENDING) {
        return {
        statusCode: 400,
        error: 'invalid token',
        message: 'No invite found or invite already accepted',
        //email: invite.email,
      };
    }

    // Step 2: If SIGNUP → tell user to sign up first
    if (invite.action === InviteActionType.SIGNUP) {
      return {
        statusCode: 400,
        error: 'signup_required',
        message: 'Your acceptance of invite is successful. Please sign up to access the course.',
        email: invite.email,
      };
    }

    // Step 3: Must be an existing user
    const user = await this.userRepo.findByEmail(invite.email);
    if (!user) {
      return {
        statusCode: 400,
        error: 'no_account',
        message: 'Register first at auth/signup',
      };
    }

    // Step 4: Check if already enrolled
    const alreadyEnrolled = await this.enrollmentRepo.findEnrollment(
      user._id.toString(),
      invite.courseId,
      invite.courseVersionId,
    );

    // Step 5: Enroll if ENROLL action and not already enrolled
    if (invite.action === InviteActionType.ENROLL && !alreadyEnrolled) {
      const enrollment: IEnrollment = {
        userId: user._id.toString(),
        courseId: invite.courseId,
        courseVersionId: invite.courseVersionId,
        status: 'active',
        enrollmentDate: new Date(),
        role: 'student', // Default to 'student' if no role is set
      };
      await this.enrollmentRepo.createEnrollment(enrollment);
      // Step 6: Mark invite as accepted
      invite.status = InviteStatusType.ACCEPTED;
      invite.action = InviteActionType.NOTIFY; // Change action to NOTIFY after enrollment
      await this.inviteRepo.updateInvite(invite);
      // Send notification email
      await this.mailService.sendMail(invite);
    }

    // Step 7: Return appropriate response
    if (invite.action === InviteActionType.NOTIFY && alreadyEnrolled) {
      return {
        statusCode: 200,
        status: 'already_enrolled',
        courseId: invite.courseId,
        courseVersionId: invite.courseVersionId,
      };
    }

    return {
      statusCode: 'enrolled',
      courseId: invite.courseId,
      courseVersionId: invite.courseVersionId,
    };
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
