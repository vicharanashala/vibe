import { inject, injectable } from 'inversify';
import {
  Authorized,
  BadRequestError,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  NotFoundError,
  Params,
  Patch,
  Post,
  Put,
  QueryParam,
  QueryParams,
  Req,
  UseInterceptor,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { GLOBAL_TYPES } from '#root/types.js';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import { CourseRegistrationService } from '../services/CourseRegistrationService.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { BadRequestErrorResponse, IUserRepository } from '#root/shared/index.js';
import { CourseVersionIdParams } from '#root/modules/notifications/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import {
  AllRegistrationsResponse,
  ApprovedRegistrationResponse,
  AutoApprovalSettingsBody,
  BulkUpdateStatusBody,
  CourseVersionDetailsResponse,
  GetPendingStudentRegistrationsParams,
  GetRejectedStudentRegistrationsParams,
  GetPendingRegistrationsParams,
  GetUnreadApprovedRegistrationsParams,
  markNotificationAsReadResponse,
  PendingRegistrationResponse,
  RegistrationFilterQuery,
  RegistrationParams,
  ToggleRegistrationBody,
  UpdateRegistrationSchemasBody,
  UpdateStatusBody,
  updateStatusBulkResponse,
  updateStatusResponse,
} from '../classes/index.js';
import {
  CourseRegistrationActions,
  courseRegistrationSubject,
  getCourseRegistrationAbility,
} from '../abilities/CourseRegistrationAbilities.js';
import { subject } from '@casl/ability';
import { UpdateCourseSettingResponse, UpdateSettingResponse } from '#root/modules/setting/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';
import { query } from 'winston';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { CourseVersionService } from '#root/modules/courses/services/index.js';

@OpenAPI({
  tags: ['CourseRegistration'],
  description: 'Operations for managing course registration',
})
@injectable()
@Authorized()
@JsonController('/course/registration')
class CourseRegistrationController {
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationService)
    private readonly courseRegistrationService: CourseRegistrationService,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepository: IUserRepository,
    @inject(COURSES_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,
  ) { }

  @OpenAPI({
    summary: 'Get Data for course Details page',
    description:
      'Get all the Data to load in the course details page for student registration.',
  })
  @Authorized()
  @Get('/version/:versionId')
  @HttpCode(200)
  @ResponseSchema(CourseVersionDetailsResponse, {
    description: 'Course details retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseDetails(@Params() params: CourseVersionIdParams) {
    const { versionId } = params;
    const result = await this.courseRegistrationService.getCourseDetails(
      versionId,
    );
    return result;
  }

  //Course Registration For students

  @OpenAPI({
    summary: 'Form Submission for User Course Registration',
    description: 'Details submitted from users for the course registration.',
    responses:
    {
      '201': {
        description: 'Course registration created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result: {
                  type: 'String',
                  example: '60d5ec49b3f1c8e4a8f8b8d1'
                }

              },
            },
          },
        },
      },
    },

  })
  @Authorized()
  @Post('/version/:versionId')
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseRegistration(
    @Params() params: CourseVersionIdParams,
    @Body() body: Record<string, any>,
    @Ability(getCourseRegistrationAbility) { ability, user },
    @Req() req: any,
  ) {
    const userId = user._id;
    const { versionId } = params;

    // Remove recaptchaToken from body before processing
    const { recaptchaToken: _, ...registrationBody } = body;

    const registrationData = {
      userId,
      versionId,
      detail: registrationBody,
      status: 'PENDING' as const,
    };

    // Check for auto-approval settings
    const [registrationSettings, version] = await Promise.all([
      this.courseRegistrationService.getSettings(versionId),
      this.courseVersionService.getVersionDetails(versionId)
    ]);

    if(version?.cohorts?.length > 0){
      if(!registrationData?.detail?.cohort){
        throw new BadRequestError('Cohort information is required for registration');
      }
    }

    const cohortId = registrationData?.detail?.cohort;
    const result = await this.courseRegistrationService.create(
      registrationData,
    );

    if(version?.cohorts?.length > 0){
      if(registrationSettings?.cohortSettings?.length > 0 && registrationSettings?.cohortSettingDetails?.some(c => c.cohortId === cohortId)){
        const cohortSetting = registrationSettings.cohortSettingDetails.find(
          c => c.cohortId === cohortId
        );
        if(cohortSetting?.registrationsAutoApproved){
          if (!cohortSetting.autoapproval_emails || cohortSetting.autoapproval_emails.length === 0) {
            await this.courseRegistrationService.updateStatus(result, "APPROVED", cohortId);
            // Return with APPROVED status when auto-approved
            return {
              registrationId: result,
              status: "APPROVED"
            };
          } else {
            const userDetails = await this.userRepository.findById(userId);
            if (userDetails?.email) {
              const userEmail = userDetails.email.toLowerCase();
              const shouldAutoApprove = cohortSetting.autoapproval_emails.some(pattern =>
                userEmail.includes(pattern.toLowerCase())
              );
              if (shouldAutoApprove) {
                await this.courseRegistrationService.updateStatus(result, "APPROVED", cohortId);
                // Return with APPROVED status when auto-approved
                return {
                  registrationId: result,
                  status: "APPROVED"
                };
              }
            }
          }
        }
      }
    } else if (registrationSettings.registrationsAutoApproved) {
      // Auto-approval is enabled
      if (!registrationSettings.autoapproval_emails || registrationSettings.autoapproval_emails.length === 0) {
        // No specific emails set - auto-approve all
        await this.courseRegistrationService.updateStatus(result, "APPROVED");
        // Return with APPROVED status when auto-approved
        return {
          registrationId: result,
          status: "APPROVED"
        };
      } else {
        // Check if user email matches any of the specified patterns
        const userDetails = await this.userRepository.findById(userId);

        if (userDetails && userDetails.email) {
          const userEmail = userDetails.email.toLowerCase();
          const shouldAutoApprove = registrationSettings.autoapproval_emails.some(pattern =>
            userEmail.includes(pattern.toLowerCase())
          );

          if (shouldAutoApprove) {
            await this.courseRegistrationService.updateStatus(result, "APPROVED");
            // Return with APPROVED status when auto-approved
            return {
              registrationId: result,
              status: "APPROVED"
            };
          }
        }
      }
    }

    // Return with PENDING status when not auto-approved
    return {
      registrationId: result,
      status: "PENDING"
    };
  }

  @OpenAPI({
    summary: 'Get all request details in instructor side',
    description:
      'Get all the Data to load in the course registration request page in instructor side',
  })
  @Get('/requests/version/:versionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(AllRegistrationsResponse, {
    description: 'All registrations retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getAllRegistrations(
    @Params() params: CourseVersionIdParams,
    @QueryParams() query: RegistrationFilterQuery,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;
    const { page, limit, status, search, sort } = query;

    const courseRegistrationResource = subject(courseRegistrationSubject, {
      versionId,
    });

    if (
      !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    ) {
      throw new ForbiddenError(
        'You do not have permission to view registrations',
      );
    }
    const result = await this.courseRegistrationService.getAllregistrations(
      versionId,
      page,
      limit,
      status,
      search,
      sort,
    );
    return result;
  }

  @OpenAPI({
    summary: 'Update Enrollment Progress',
    description: 'Update the registration status of a student',
  })
  @Authorized()
  @Patch('/status/:registrationId', { transformResponse: true })
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(updateStatusResponse, {
    description: 'Registration status updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatus(
    @Params() params: RegistrationParams,
    @Body() body: UpdateStatusBody,
    @Ability(getCourseRegistrationAbility) { ability, user },
    @Req() req: Request,
  ) {
    const { registrationId } = params;
    const { status, cohort } = body;

    const result = await this.courseRegistrationService.updateStatus(
      registrationId,
      status,
      cohort
    );

    setAuditTrail(req, {
      category: AuditCategory.REGISTRATION,
      action: result.status === "APPROVED" ? AuditAction.REGISTRATION_APPROVE : AuditAction.REGISTRATION_REJECT,
      actor: {
        id: new ObjectId(user._id),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role
      },
      context: {
        registrationId,
        courseId: new ObjectId(result.courseId),
        courseVersionId: new ObjectId(result.versionId),
        userId: new ObjectId(result.userId),
      },
      changes:{
        after:{
          status: result.status,
          name: result.detail.Name,
          email: result.detail.Email,
        }
      },

      outcome: {
        status: OutComeStatus.SUCCESS,
      }
    })

    return {
      message: 'Registration status updated successfully',
      registration: result,
    };
  }

  @OpenAPI({
    summary: 'Update Enrollment Progress on Bulk',
    description: 'Update the status of registration on Bulk Manner',
  })
  @Authorized()
  @Patch('/status/update/bulk', { transformResponse: true })
  @ResponseSchema(updateStatusBulkResponse, {
    description: 'Registration status updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatusBulk(
    @Body() body: BulkUpdateStatusBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { selected } = body;
    const result = await this.courseRegistrationService.updateBulkStatus(
      selected,
    );
    return {
      message: 'Registration status updated successfully',
      registration: result,
    };
  }

  @OpenAPI({
    summary: 'Get Registration Settings',
    description: 'Get the registration settings for a course version',
  })
  @Get('/build-form/version/:versionId')
  @Authorized()
  @ResponseSchema(UpdateRegistrationSchemasBody, {
    description: 'Registration settings retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getSettings(
    @Params() params: CourseVersionIdParams,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;

    const courseRegistrationResource = subject(courseRegistrationSubject, {
      versionId,
    });

    if (
      !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    ) {
      throw new ForbiddenError('You do not have permission to view this page');
    }

    return this.courseRegistrationService.getSettings(versionId);
  }

  @Put('/build-form/version/:versionId')
  @Authorized()
  @ResponseSchema(UpdateSettingResponse, {
    description: 'Registration settings updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateSettings(
    @Params() params: CourseVersionIdParams,
    @Body() body: UpdateRegistrationSchemasBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;
    if (
      !ability.can(
        CourseRegistrationActions.Modify,
        subject(courseRegistrationSubject, { versionId }),
      )
    ) {
      throw new ForbiddenError('You do not have permission to modify settings');
    }
    return this.courseRegistrationService.updateSettings(versionId, body);
  }

  @OpenAPI({
    summary: 'Update Auto-Approval Settings',
    description: 'Update auto-approval settings for course registrations',
  })
  @Put('/auto-approval/version/:versionId')
  @Authorized()
  @ResponseSchema(UpdateSettingResponse, {
    description: 'Auto-approval settings updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateAutoApprovalSettings(
    @Params() params: CourseVersionIdParams,
    @Body() body: AutoApprovalSettingsBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;

    if (
      !ability.can(
        CourseRegistrationActions.Modify,
        subject(courseRegistrationSubject, { versionId }),
      )
    ) {
      throw new ForbiddenError('You do not have permission to modify auto-approval settings');
    }

    // Get current settings to preserve existing schema and isActive
    const currentSettings = await this.courseRegistrationService.getSettings(versionId);

    return this.courseRegistrationService.updateAutoApprovalSettings(
      versionId, 
      {
        jsonSchema: currentSettings.jsonSchema,
        uiSchema: currentSettings.uiSchema,
        isActive: currentSettings.isActive,
        registrationsAutoApproved: body.registrationsAutoApproved,
        autoapproval_emails: body.autoapproval_emails,
        cohortSettings: currentSettings.cohortSettings,
      },
      body.cohortId
    );
  }

  @OpenAPI({
    summary: 'Toggle Course Registration Active Status',
    description: 'Enable or disable course registration without needing to send schema data',
  })
  @Patch('/registration/version/:versionId/toggle')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(UpdateSettingResponse, {
    description: 'Registration status toggled successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async toggleRegistration(
    @Params() params: CourseVersionIdParams,
    @Body() body: ToggleRegistrationBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;
    const { isActive } = body;

    if (
      !ability.can(
        CourseRegistrationActions.Modify,
        subject(courseRegistrationSubject, { versionId }),
      )
    ) {
      throw new ForbiddenError('You do not have permission to modify settings');
    }

    return this.courseRegistrationService.toggleRegistrationStatus(versionId, isActive);
  }

  @OpenAPI({
    summary: 'Get Data for student registration form',
    description:
      'Get all the Data to load in the register form page for student registration.',
  })
  @Get('/form/version/:versionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(UpdateRegistrationSchemasBody, {
    description: 'Course details retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getRegistrationForm(
    @Params() params: CourseVersionIdParams,
    // @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;

    // const courseRegistrationResource = subject(courseRegistrationSubject, {
    //   versionId,
    // });

    // if (
    //   !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    // ) {
    //   throw new ForbiddenError('You do not have permission to view registration form');
    // }

    const result = await this.courseRegistrationService.getRegistrationForm(
      versionId,
    );
    return result;
  }

  @OpenAPI({
    summary: 'Get pending registrations',
    description:
      'Get all pending registrations for an instructor.',
  })
  @Get('/pending')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(PendingRegistrationResponse, {
    description: 'Pending registrations retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getPendingRegistrations(
    @QueryParams() query: GetPendingRegistrationsParams,
    @Ability(getCourseRegistrationAbility) { ability, user },
  ) {
    const { instructorId } = query;
    const userId = user._id;


    // Find instructor's MongoDB _id using their firebaseUID
    const instructorRecord = await this.userRepository.findByFirebaseUID(instructorId);

    if (!instructorRecord) {
      throw new NotFoundError('Instructor not found');
    }

    const mongoInstructorId = instructorRecord._id.toString();

    if (
      !ability.can(
        CourseRegistrationActions.View,
        subject(courseRegistrationSubject, { instructorId: mongoInstructorId }),
      )
    ) {
      throw new ForbiddenError('You do not have permission to view pending registrations');
    }
    const result = await this.courseRegistrationService.getPendingRegistrations(mongoInstructorId);

    return result;
  }

  @OpenAPI({
    summary: 'Get pending registrations for student dashboard',
    description:
      'Get all pending course registrations for a student to display waiting-for-approval status.',
  })
  @Get('/pending/student')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(PendingRegistrationResponse, {
    description: 'Pending student registrations retrieved successfully',
    statusCode: 200,
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getPendingRegistrationsForStudent(
    @QueryParams() query: GetPendingStudentRegistrationsParams,
    @Ability(getCourseRegistrationAbility) { user },
  ) {
    const { studentId } = query;

    if (user.firebaseUID !== studentId && user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only view your own pending registrations');
    }

    const userRecord = await this.userRepository.findByFirebaseUID(studentId);
    if (!userRecord) {
      throw new NotFoundError('User not found');
    }

    return this.courseRegistrationService.getPendingRegistrationsByStudent(userRecord._id.toString());
  }

  @OpenAPI({
    summary: 'Get rejected registrations for student notifications',
    description:
      'Get all unread rejected course registrations for a student to display in notifications.',
  })
  @Get('/rejected/student')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(PendingRegistrationResponse, {
    description: 'Rejected student registrations retrieved successfully',
    statusCode: 200,
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getRejectedRegistrationsForStudent(
    @QueryParams() query: GetRejectedStudentRegistrationsParams,
    @Ability(getCourseRegistrationAbility) { user },
  ) {
    const { studentId } = query;

    if (user.firebaseUID !== studentId && user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only view your own registrations');
    }

    const userRecord = await this.userRepository.findByFirebaseUID(studentId);
    if (!userRecord) {
      throw new NotFoundError('User not found');
    }

    return this.courseRegistrationService.getRejectedRegistrationsByStudent(userRecord._id.toString());
  }


  @OpenAPI({
    summary: 'Get unread approved registrations for students',
    description:
      'Get all unread approved course registrations for a student to show notifications.',
  })
  @Get('/notifications/unread')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ApprovedRegistrationResponse, {
    description: 'Unread approved registrations retrieved successfully',
    statusCode: 200,
    isArray: true
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getUnreadApprovedRegistrations(
    @QueryParams() query: GetUnreadApprovedRegistrationsParams,
    @Ability(getCourseRegistrationAbility) { ability, user },
  ) {
    const { studentId } = query;

    // Students can only view their own notifications - compare firebaseUID
    if (user.firebaseUID !== studentId && user.role !== 'ADMIN') {
      throw new ForbiddenError('You can only view your own notifications');
    }

    // Find user's MongoDB _id using their firebaseUID
    const userRecord = await this.userRepository.findByFirebaseUID(studentId);

    if (!userRecord) {
      throw new NotFoundError('User not found');
    }

    return this.courseRegistrationService.getUnreadApprovedRegistrations(userRecord._id.toString());
  }

  @OpenAPI({
    summary: 'Mark notification as read',
    description:
      'Mark a course registration notification as read for a student.',
  })
  @Patch('/notifications/:registrationId/read', { transformResponse: true })
  @Authorized()
  @ResponseSchema(markNotificationAsReadResponse, {
    description: 'Notification marked as read successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async markNotificationAsRead(
    @Params() params: RegistrationParams,
    @Ability(getCourseRegistrationAbility) { ability, user },
  ) {
    const { registrationId } = params;

    const result = await this.courseRegistrationService.markNotificationAsRead(registrationId);

    return {
      message: 'Notification marked as read successfully',
      success: result
    };
  }
}

export { CourseRegistrationController };
