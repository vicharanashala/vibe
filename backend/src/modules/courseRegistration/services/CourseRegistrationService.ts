import 'reflect-metadata';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable } from 'inversify';
import { ForbiddenError, InternalServerError, NotFoundError, BadRequestError } from 'routing-controllers';
import nodemailer from 'nodemailer';
import {
  BaseService,
  CourseRepository,
  EnrollmentRepository,
  EnrollmentRole,
  EnrollmentStatus,
  ICourse,
  ICourseRegistration,
  IItemRepository,
  InviteType,
  ISettingRepository,
  IUserRepository,
  MongoDatabase,
} from '#root/shared/index.js';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import {
  Invite,
  InviteService,
  MailService,
} from '#root/modules/notifications/index.js';
import { ClientSession, ObjectId } from 'mongodb';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { NOTIFICATIONS_TYPES } from '#root/modules/notifications/types.js';
import { appConfig } from '#root/config/app.js';
import { ICourseRegistrationRepository } from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';

@injectable()
export class CourseRegistrationService extends BaseService {
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository)
    private courseRegistrationRepo: ICourseRegistrationRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(NOTIFICATIONS_TYPES.InviteService)
    private readonly inviteService: InviteService,
    @inject(NOTIFICATIONS_TYPES.MailService)
    private readonly mailService: MailService,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: CourseRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  async createStatusEmailMessage(
    registration: ICourseRegistration,
    course: ICourse,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    cohort?: string,
  ): Promise<Omit<nodemailer.SendMailOptions, 'from'>> {
    const userDetails = await this.userRepo.findById(registration.userId);
    const statusText = status.toLowerCase();
    let subject = `Your registration request for ${course.name} ${cohort ? `in cohort ${cohort}` : ''} is ${statusText}`;
    let greeting = '';
    let bodyText = '';
    let buttonText = '';
    let buttonHref = '';

    switch (status) {
      case 'APPROVED':
        greeting = 'Congratulations!';
        bodyText = `Your registration for the course "${course.name}" has been approved. You can now access the course via our platform.\n\nTo get started, please click the link below:\n${appConfig.origins[0]}/student/courses \n\nWe look forward to your participation!`;
        buttonText = 'Access Course';
        // buttonHref = `${appConfig.url}${appConfig.routePrefix}/courses/${course._id.toString()}`;
        buttonHref = `${appConfig.origins[0]}/student/courses`;
        break;
      case 'REJECTED':
        greeting = 'We regret to inform you...';
        bodyText = `Unfortunately, your registration for the course "${course.name}" has been rejected. If you have any questions, please contact our support team.\n\nBest regards,\nTechnical Team, CBPAI, IIT Ropar`;
        // No button for rejected
        break;
      case 'PENDING':
        greeting = 'Registration Update';
        bodyText = `Your registration request for the course "${course.name}" is now pending review. You will be notified once a decision has been made.\n\nThank you for your patience.\nBest regards,\nTechnical Team, CBPAI, IIT Ropar`;
        // No button for pending
        break;
    }

    const textBody = `Dear ${userDetails.firstName || 'Participant'
      },\n\n${greeting}\n\n${bodyText}`;

    const htmlBody = `<!DOCTYPE html>
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
  <title>Registration Status Update</title>
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

          <!-- Greeting and status -->
          <tr>
            <td style="font-family:Arial, sans-serif; font-size:16px; line-height:1.6; padding:0 24px 24px;">
              <p style="margin:0 0 16px;">
                Dear ${userDetails.firstName || 'Participant'},
              </p>
              <p style="margin:0 0 16px; font-size:18px; font-weight:bold; color:${status === 'APPROVED'
        ? '#4caf50'
        : status === 'REJECTED'
          ? '#f44336'
          : '#ff9800'
      };">
                ${greeting}
              </p>
              <p style="margin:0 0 16px;">
                Your registration for the course <strong style="color:#ff9800;">${course.name
      }</strong> has been updated to <strong style="color:${status === 'APPROVED'
        ? '#4caf50'
        : status === 'REJECTED'
          ? '#f44336'
          : '#ff9800'
      };">${status}</strong>.
              </p>
              ${status !== 'REJECTED' && status !== 'PENDING'
        ? `
              <p style="margin:0 0 16px;">
                You can now access the course via our platform.
              </p>
              `
        : ''
      }
            </td>
          </tr>

          <!-- CTA Button if applicable -->
          ${buttonHref
        ? `
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ff9800" style="border-radius:6px; padding:16px 40px; text-align:center;">
                    <a href="${buttonHref}"
                       style="font-family:Arial, sans-serif; font-size:20px; font-weight:bold; color:#ffffff; text-decoration:none; display:inline-block;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
        : ''
      }

          <!-- Closing -->
          <tr>
            <td style="padding:0 24px 32px; font-family:Arial, sans-serif; font-size:13px; line-height:1.6; color:#666;">
              <p style="margin:0;">
                Best regards,<br>
                Technical Team, CBPAI, IIT Ropar
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
      to: userDetails.email,
      subject,
      text: textBody,
      html: htmlBody,
    };
  }

  async generateLink(courseId: string, versionId: string) {
    const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
                
    if(versionStatus==="archived"){
      throw new ForbiddenError("This enrollment is invalid. Because course version is archived.");
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = new Invite({
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(versionId),
      role: 'STUDENT',
      expiresAt,
      type: InviteType.BULK,
    });
  }

  async getCourseDetails(versionId: string) {
    return this._withTransaction(async session => {
      const courseVersion = await this.courseRepo.readVersion(
        versionId,
        session,
      );
      const course = await this.courseRepo.read(
        courseVersion.courseId as string,
        session,
      );
      const modules = [];
      let totalItems = 0;
      for (const mod of courseVersion.modules || []) {
        // Collect all itemsGroupIds from sections in this module
        const groupIds = mod.sections
          ? mod.sections.map(section => section.itemsGroupId).filter(id => id)
          : [];
        // Fetch total items for the module
        const itemsCount = await this.itemRepo.getItemsCountByGroupIds(
          groupIds as string[],
          session,
        );
        totalItems += itemsCount;

        modules.push({
          id: mod.moduleId, // Use moduleId if available
          name: mod.name,
          description: mod.description,
          itemsCount,
        });
      }

      // Fetch instructors
      const instructorIds = await this.enrollmentRepo.getInstructorIdsByVersion(
        courseVersion.courseId.toString(),
        versionId,
        session,
      );
      const instructorDetails = await this.userRepo.getUserNamesByIds(
        instructorIds as string[],
        session,
      );
      let cohorts;
      if(courseVersion.cohorts && courseVersion.cohorts.length > 0){
        const cohortsDetails = await this.courseRepo.getCohortsByIds(courseVersion.cohorts)
        cohorts = cohortsDetails.map(c => ({
          cohortId: c._id.toString(),
          cohortName: c.name,
          isActive: c.isActive ?? true,
        }));
      }

      // Construct the final output (match your sample structure)
      return {
        id: 'v1', // Hardcode or generate dynamically, e.g., based on version string
        courseId: courseVersion.courseId.toString(),
        course: course,
        version: `${courseVersion.version} - ${course.name}`, // Combined as in your example
        description: course.description || courseVersion.description, // Use course desc if version desc is short
        modules,
        totalItems,
        createdAt: courseVersion.createdAt,
        updatedAt: courseVersion.updatedAt,
        instructors: instructorDetails,
        cohorts: cohorts 
      };
    });
  }

  async create(
    registrationData: Omit<
      ICourseRegistration,
      'courseId' | 'createdAt' | 'updatedAt'
    >,
  ) {
    return this._withTransaction(async session => {
      const courseVersion = await this.courseRepo.readVersion(
        registrationData.versionId.toString(),
        session,
      );
      const versionStatus=await this.courseRepo.getCourseVersionStatus(registrationData.versionId.toString());
                
    if(versionStatus==="archived"){
      throw new ForbiddenError("The course version you are trying to register is inactive");
    }

      if (courseVersion.cohorts && courseVersion.cohorts.length > 0) {

        // If cohorts exist, cohort must be provided
        if (!registrationData.detail.cohort) {
          throw new Error(
            "Cohorts exist for this version. Please select at least one cohort."
          );
        }

        // Validate that cohort matches one of the available cohorts
        const isValidCohort = courseVersion.cohorts.some(
          (cohort: any) => cohort?.toString() === registrationData.detail.cohort
        );

        if (!isValidCohort) {
          throw new Error(
            "Cohort name must match one of the available cohorts for this version."
          );
        }
      }

      const courseSettings = await this.settingsRepo.readCourseSettings(
        courseVersion.courseId.toString(),
        registrationData.versionId.toString(),
        session,
      );

      const regSettings = courseSettings?.settings?.registration;

      if (regSettings?.isActive === false || String(regSettings?.isActive) === 'false') {
        throw new Error('Course registration is not active');
      }

      if (courseVersion.cohorts && courseVersion.cohorts.length > 0) {
        const requestExisits = await this.courseRegistrationRepo.findPendingRequestsByUserIdAndCohort(
          registrationData.userId.toString(),
          registrationData.versionId.toString(),
          registrationData.detail.cohort,
          session,
        );
        if (requestExisits) {
          throw new Error('You are already registered for this cohort of the course');
        }
      }
      else{
        const requestExisits = await this.courseRegistrationRepo.findPendingRequestsByUserId(
          registrationData.userId.toString(),
          registrationData.versionId.toString(),
          session,
        );
        if (requestExisits) {
          throw new Error('You are already registered for this course');
        }
      }

      const enrollmentExists = await this.enrollmentService.findEnrollment(
        registrationData.userId.toString(),
        courseVersion.courseId.toString(),
        registrationData.versionId.toString(),
        registrationData.detail.cohort
      );

      if (enrollmentExists) {
        throw new Error('You are already enrolled in this course');
      }
      const data: ICourseRegistration = {
        ...registrationData,
        userId: new ObjectId(registrationData.userId),
        versionId: new ObjectId(registrationData.versionId),
        courseId: new ObjectId(courseVersion.courseId.toString()),
        cohortId: registrationData.detail.cohort ? new ObjectId(String(registrationData.detail.cohort)) : undefined,
        createdAt: new Date(),
        updatedAt: null,
      };
      if (registrationData.detail?.cohort) {
        delete registrationData.detail.cohort;
      }
      return await this.courseRegistrationRepo.create(data, session);
    });
  }

  async getAllregistrations(
    versionId: string,
    page: number,
    limit: number,
    status: string,
    search: string,
    sort: 'older' | 'latest',
  ) {
    return this._withTransaction(async session => {
      const skip = (page - 1) * limit;

      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) {
        throw new NotFoundError(
          `Course version with id ${versionId} not found`,
        );
      }
      const { registrations, totalDocuments } =
        await this.courseRegistrationRepo.findAllregistrations(
          version,
          { status, search },
          skip,
          limit,
          sort,
          session,
        );

      const courseId = version.courseId.toString();
      let courseSettings = await this.settingsRepo.readCourseSettings(
        courseId,
        versionId,
        session,
      );

      if (!courseSettings) {
        throw new NotFoundError(
          `Course settings for course ID ${courseId} and version ID ${versionId} not found.`,
        );
      }

      let { jsonSchema, uiSchema } = courseSettings.settings?.registration || {};
      if (!jsonSchema || !uiSchema) {
        const defaultJsonSchema = {
          type: 'object',
          properties: {
            Name: {
              type: 'string',
              title: 'Name',
              minLength: 1,
            },
            Email: {
              type: 'string',
              format: 'email',
              title: 'Email',
            },
            Phone: {
              type: 'string',
              title: 'Phone',
            },
          },
          required: ['Name', 'Email'],
        };

        const defaultUiSchema = {
          Name: {
            'ui:placeholder': 'Enter your Name',
          },
          Email: {
            'ui:placeholder': 'Enter your Email',
          },
          Phone: {
            'ui:options': {
              inputType: 'tel',
            },
            'ui:placeholder': 'Enter your Phone Number',
          },
        };

        await this.settingsRepo.updateRegistrationSchemas(
          courseId,
          versionId,
          { jsonSchema: defaultJsonSchema, uiSchema: defaultUiSchema, isActive: true },
          session,
        );
      }
      return {
        totalDocuments,
        totalPages: Math.ceil(totalDocuments / limit),
        currentPage: page,
        registrations,
      };
    });
  }

  async updateStatus(
    registrationId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    cohort?: string
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      try {
        const data = await this.courseRegistrationRepo.getRegistration(
          registrationId,
          session,
        );
        if (!data) {
          throw new NotFoundError(
            `Registration with id ${registrationId} not found`,
          );
        }
        const versionStatus=await this.courseRepo.getCourseVersionStatus(data.versionId.toString(),session);
                
        if(versionStatus==="archived"){
          throw new ForbiddenError("Can't process registrations. Because course version is archived.");
        }

        const fetchedCohort = await this.courseRepo.getCohortsByIds([new ObjectId(cohort)])

        await this.inviteService.courseContentLength(
          data.courseId.toString(),
          data.versionId.toString(),
          session,
        );

        // return await this.courseRegistrationRepo.updateStatus(
        //   registrationId,
        //   status,
        //   session,
        // );
        const course = await this.courseRepo.read(
          data.courseId.toString(),
          session,
        );
        if (!course) {
          throw new NotFoundError('Course not found');
        }
        const updateResult = await this.courseRegistrationRepo.updateStatus(
          registrationId,
          status,
          session,
        );
        if (status === 'APPROVED') {
          const THROUGH_INVITE = true;
          await this.enrollmentService.enrollUser(
            data.userId.toString(),
            data.courseId.toString(),
            data.versionId.toString(),
            'STUDENT',
            THROUGH_INVITE,
            cohort,
            session,
          );
        }
        const emailMessage = await this.createStatusEmailMessage(
          data,
          course,
          status,
          fetchedCohort[0]?.name,
        );
        try {
          await this.mailService.sendMail(emailMessage);
        } catch (emailError) {
          console.log(`Failed to send email /MORE ${emailError}`);
          // throw new InternalServerError(
          //   `Failed to send email /MORE ${emailError}`,
          // );
        }

        return updateResult;
      } catch (error) {
        console.log(error);
        throw new InternalServerError(
          `Failed to update registration status MORE/${error}`,
        );
      }
    });
  }

  async updateBulkStatus(registrationIds: string[]) {
    return this._withTransaction(async (session: ClientSession) => {
      try {
        const first = await this.courseRegistrationRepo.getRegistration(
          registrationIds[0],
          session,
        );
        if (!first) {
          throw new NotFoundError(
            `Registration with id ${registrationIds[0]} not found`,
          );
        }
        const versionStatus=await this.courseRepo.getCourseVersionStatus(first.versionId.toString(),session);
                
        if(versionStatus==="archived"){
          throw new ForbiddenError("Cannot process registrations. Because course version is archived.");
        }
        await this.inviteService.courseContentLength(
          first.courseId.toString(),
          first.versionId.toString(),
          session,
        );
        for (let registrationId of registrationIds) {
          const item = await this.courseRegistrationRepo.getRegistration(
            registrationId,
            session,
          );
          if (!item) continue;
          const existingEnrollment = await this.enrollmentRepo.findEnrollment(
            item.userId.toString(),
            item.courseId.toString(),
            item.versionId.toString(),
            item.cohortId?.toString(),
            session,
          );
          if (existingEnrollment) continue;

          const course = await this.courseRepo.read(
            item.courseId.toString(),
            session,
          );
          if (!course) {
            throw new NotFoundError('Course not found');
          }
          const THROUGH_INVITE = true;
          await this.enrollmentService.enrollUser(
            item.userId.toString(),
            item.courseId.toString(),
            item.versionId.toString(),
            'STUDENT',
            THROUGH_INVITE,
            item.cohortId?.toString(),
            session,
          );
          const emailMessage = await this.createStatusEmailMessage(
            item,
            course,
            'APPROVED',
            item?.cohortId?.toString(),
          );
          try {
            await this.mailService.sendMail(emailMessage);
          } catch (emailError) {
            throw new InternalServerError(
              `Failed to send email /MORE ${emailError}`,
            );
          }
        }
        return await this.courseRegistrationRepo.updateBulkStatus(
          registrationIds,
          session,
        );
      } catch (error) {
        throw new InternalServerError(
          'Failed to bulk update registration status',
        );
      }
    });
  }

  async getSettings(
    versionId: string,
  ): Promise<{ jsonSchema: any; uiSchema: any; isActive: boolean, registrationsAutoApproved?: boolean, autoapproval_emails?: string[], cohortSettings?: ObjectId[] , cohortSettingDetails?: any[]}> {
    return this._withTransaction(async session => {
      try {
        const version = await this.courseRepo.readVersion(versionId, session);
        if (!version) {
          throw new NotFoundError(
            `Course version with id ${versionId} not found`,
          );
        }

        const courseId = version.courseId.toString();

        let courseSettings = await this.settingsRepo.readCourseSettings(
          courseId,
          versionId,
          session,
        );

        if (!courseSettings) {
          throw new NotFoundError(
            `Course settings for course ID ${courseId} and version ID ${versionId} not found.`,
          );
        }

        const cohortSettingDetails = [];
        if(courseSettings.settings?.registration?.cohortSettings?.length > 0){
          for (const cohortSetting of courseSettings.settings?.registration?.cohortSettings) {
            const detail = await this.courseRepo.getCohortSettingById(
              cohortSetting.toString(),
              session
            );
            cohortSettingDetails.push({...detail, cohortId: detail?.cohortId?.toString(), courseVersionId: detail.courseVersionId.toString()});
          }
        }
        let { jsonSchema, uiSchema, isActive, registrationsAutoApproved, autoapproval_emails, cohortSettings } =
          courseSettings.settings?.registration || {};

        //   // const defaultUiSchema = {
        //   //   type: 'VerticalLayout',
        //   //   elements: [
        //   //     {
        //   //       type: 'Control',
        //   //       scope: '#/properties/name',
        //   //     },
        //   //     {
        //   //       type: 'Control',
        //   //       scope: '#/properties/email',
        //   //     },
        //   //     {
        //   //       type: 'Control',
        //   //       scope: '#/properties/phone',
        //   //     },
        //   //   ],
        //   // };

        // return { jsonSchema, uiSchema, isActive: isActive ?? true };
         return { 
          jsonSchema, 
          uiSchema, 
          isActive: isActive ?? true, 
          registrationsAutoApproved, 
          autoapproval_emails,
          cohortSettings: cohortSettings || [],
          cohortSettingDetails: cohortSettingDetails
        };

        // return registrationSettings;
      } catch (error) {
        throw new InternalServerError('Failed to get settings');
      }
    });
  }

  async updateSettings(
    versionId: string,
    schemas: { jsonSchema: any; uiSchema: any; isActive?: boolean; registrationsAutoApproved?: boolean; autoapproval_emails?: string[] },
  ) {
    return this._withTransaction(async session => {
      try {
        const version = await this.courseRepo.readVersion(versionId, session);
        if (!version) {
          throw new NotFoundError(
            `Course version with id ${versionId} not found`,
          );
        }
        const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
                
        if(versionStatus==="archived"){
          throw new ForbiddenError("Cannot update settings. Because course version is archived.");
        }
        const courseId = version.courseId.toString();
        return await this.settingsRepo.updateRegistrationSettings(
          courseId,
          versionId,
          // settings,
          {
            jsonSchema: schemas.jsonSchema,
            uiSchema: schemas.uiSchema,
            isActive: schemas.isActive ?? true,
            registrationsAutoApproved: schemas.registrationsAutoApproved,
            autoapproval_emails: schemas.autoapproval_emails,
          },
          session,
        );
      } catch (error) {
        console.error(error);
        throw new InternalServerError('Failed to update settings');
      }
    });
  }


  async updateAutoApprovalSettings(
    versionId: string,
    schemas: { jsonSchema: any; uiSchema: any; isActive?: boolean; registrationsAutoApproved?: boolean; autoapproval_emails?: string[], cohortSettings?: ObjectId[] },
    cohortId?: string
  ) {
    return this._withTransaction(async session => {
      try {
        const version = await this.courseRepo.readVersion(versionId, session);
        if (!version) {
          throw new NotFoundError(
            `Course version with id ${versionId} not found`,
          );
        }
        const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
                
        if(versionStatus==="archived"){
          throw new ForbiddenError("Cannot update settings. Because course version is archived.");
        }
        const courseId = version.courseId.toString();

        if(version?.cohorts?.length > 0){
          if(!cohortId){
            throw new BadRequestError("Cohort ID is required for this course version.");
          }
          if(!version.cohorts.some((c: ObjectId) => c.toString() === cohortId)){
            throw new BadRequestError("Invalid Cohort ID provided.");
          }
          let cohortSetting = await this.courseRepo.getCohortSetting(version._id.toString(), cohortId, session);
          if(cohortSetting){
            await this.courseRepo.updateCohortSettings(cohortSetting, schemas.registrationsAutoApproved ?? false, schemas.autoapproval_emails ?? [], session);
            return await this.settingsRepo.readCourseSettings(
              courseId,
              versionId,
              session,
            );
          } else {
            cohortSetting = await this.courseRepo.createCohortSettings(version._id.toString(), cohortId, schemas.registrationsAutoApproved ?? false, schemas.autoapproval_emails ?? [], session );
            return await this.settingsRepo.updateCohortSettings(
              courseId,
              versionId,
              {
                cohortSettings: schemas.cohortSettings ? [...schemas.cohortSettings, new ObjectId(cohortSetting)] : [new ObjectId(cohortSetting)]
              },
              session,
            );
          }
        }

        return await this.settingsRepo.updateRegistrationSettings(
          courseId,
          versionId,
          // settings,
          {
            jsonSchema: schemas.jsonSchema,
            uiSchema: schemas.uiSchema,
            isActive: schemas.isActive ?? true,
            registrationsAutoApproved: schemas.registrationsAutoApproved,
            autoapproval_emails: schemas.autoapproval_emails,
          },
          session,
        );
      } catch (error) {
        console.error(error);
        throw new InternalServerError('Failed to update settings');
      }
    });
  }

  async getRegistrationForm(versionId: string) {
    const defaultJsonSchema = {
      type: 'object',
      properties: {
        Name: {
          type: 'string',
          title: 'Name',
          minLength: 1,
        },
        Email: {
          type: 'string',
          format: 'email',
          title: 'Email',
        },
        Phone: {
          type: 'string',
          title: 'Phone',
        },
      },
      required: ['Name', 'Email'],
    };

    const defaultUiSchema = {
      Name: {
        'ui:placeholder': 'Enter your Name',
      },
      Email: {
        'ui:placeholder': 'Enter your Email',
      },
      Phone: {
        'ui:options': {
          inputType: 'tel',
        },
        'ui:placeholder': 'Enter your Phone Number',
      },
    };

    return this._withTransaction(async session => {
      const result = await this.settingsRepo.readSettingsSchema(
        versionId,
        session,
      );

      // If no schema is configured, return the defaults
      if (!result.jsonSchema || Object.keys(result.jsonSchema).length === 0) {
        return {
          jsonSchema: defaultJsonSchema,
          uiSchema: defaultUiSchema,
          isActive: result.isActive ?? true
        };
      }

      return result;
    });
  }

  async toggleRegistrationStatus(versionId: string, isActive: boolean) {
    return this._withTransaction(async session => {
      try {
        const version = await this.courseRepo.readVersion(versionId, session);
        if (!version) {
          throw new NotFoundError(
            `Course version with id ${versionId} not found`,
          );
        }
        const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
                
        if(versionStatus==="archived"){
          throw new ForbiddenError("Can't toggle Regitration status. Because course version is archived.");
        }
        const courseId = version.courseId.toString();

        // Use updateRegistrationSchemas which supports partial updates
        return await this.settingsRepo.updateRegistrationSchemas(
          courseId,
          versionId,
          { isActive }, // Only pass isActive
          session,
        );
      } catch (error) {
        console.error(error);
        throw new InternalServerError('Failed to toggle registration status');
      }
    });
  }


  async getPendingRegistrations(instructorId: string) {
    return this._withTransaction(async session => {
      return await this.courseRegistrationRepo.getPendingRegistrations(instructorId, session);
    });
  }

  async getPendingRegistrationsByStudent(studentId: string) {
    return this._withTransaction(async session => {
      return await this.courseRegistrationRepo.getPendingRegistrationsByStudent(studentId, session);
    });
  }

  async getRejectedRegistrationsByStudent(studentId: string) {
    return this._withTransaction(async session => {
      return await this.courseRegistrationRepo.getRejectedRegistrationsByStudent(studentId, session);
    });
  }

  async getUnreadApprovedRegistrations(studentId: string) {
    return this._withTransaction(async session => {
      return await this.courseRegistrationRepo.getUnreadApprovedRegistrations(studentId, session);
    });
  }

  async markNotificationAsRead(registrationId: string) {
    return this._withTransaction(async session => {
      return await this.courseRegistrationRepo.markNotificationAsRead(registrationId, session);
    });
  }
}
