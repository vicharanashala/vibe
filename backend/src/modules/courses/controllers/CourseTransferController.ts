import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {subject} from '@casl/ability';
import {inject, injectable} from 'inversify';
import {ObjectId} from 'mongodb';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  Req,
  Res,
  UseInterceptor,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {CourseTransferService} from '#courses/services/CourseTransferService.js';
import {
  CourseBundle,
  ExportCourseVersionParams,
  ImportCourseResponse,
} from '#courses/classes/validators/CourseTransferValidators.js';
import {CourseActions, getCourseAbility} from '../abilities/courseAbilities.js';
import {CourseNotFoundErrorResponse} from '#courses/classes/validators/CourseValidators.js';

const NOT_CARRIED_BY_BUNDLE =
  'The bundle carries course content only. Instructors, enrollments, cohorts, student progress, watch time, invites, HP, announcements, ejection history and crowd-sourced student questions are not included, and neither are AI transcripts or segment context (they point at storage objects on the source server). Video items keep their YouTube URLs, so they play on the target server as long as it can reach YouTube. Course settings travel with two exceptions: the imported course is always created non-public, and linear progression always comes up enabled regardless of the source (course-settings creation forces it on), so switch it off on the new course if the original had it off.';

@OpenAPI({
  tags: ['Courses'],
  description: 'Move a course between ViBe servers as a JSON bundle',
})
@injectable()
@JsonController('/courses')
export class CourseTransferController {
  constructor(
    @inject(COURSES_TYPES.CourseTransferService)
    private readonly courseTransferService: CourseTransferService,
  ) {}

  @OpenAPI({
    summary: 'Export a course version',
    description: `Serialises the named course version into a self-contained JSON bundle that can be imported on another ViBe server. The version to bundle is always given explicitly, and the bundle records which one it was.<br/><br/>${NOT_CARRIED_BY_BUNDLE}<br/><br/>Accessible to:
- Admins, for any course.
- Managers of the course.`,
  })
  @Authorized()
  @Get('/:courseId/version/:versionId/export')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course or version not found',
    statusCode: 404,
  })
  async export(
    @Params() params: ExportCourseVersionParams,
    @Ability(getCourseAbility) {ability, user},
    @Req() req: any,
    @Res() res: any,
  ) {
    const {courseId, versionId} = params;

    // Gated at the course level, not the version: exporting is a
    // whole-course capability held by admins and managers, and deliberately
    // not by instructors of the course.
    const courseSubject = subject('Course', {courseId});
    if (!ability.can(CourseActions.Export, courseSubject)) {
      throw new ForbiddenError(
        'You do not have permission to export this course',
      );
    }

    const bundle = await this.courseTransferService.exportCourseVersion(
      courseId,
      versionId,
    );

    setAuditTrail(req, {
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_EXPORT,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slugify(bundle.course.name)}-${slugify(
        bundle.version.version,
      )}.vibe.json"`,
    );
    return res.json(bundle);
  }

  @OpenAPI({
    summary: 'Import a course from a bundle',
    description: `Creates a new course from a bundle produced by the export endpoint. The importing user becomes the instructor of the new course and the author of record for its questions.<br/><br/>${NOT_CARRIED_BY_BUNDLE}<br/><br/>Accessible to:
- Any user permitted to create courses.`,
  })
  @Authorized()
  @Post('/import')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(201)
  @ResponseSchema(ImportCourseResponse, {
    description: 'Course imported successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async import(
    // Question-heavy bundles run to a few megabytes, well past the body
    // parser's default limit.
    @Body({options: {limit: '25mb'}}) bundle: CourseBundle,
    @Ability(getCourseAbility) {ability, user},
    @Req() req: any,
  ): Promise<ImportCourseResponse> {
    if (!ability.can(CourseActions.Create, 'Course')) {
      throw new ForbiddenError('You do not have permission to create courses');
    }

    const created = await this.courseTransferService.importCourse(
      bundle,
      user._id.toString(),
    );

    setAuditTrail(req, {
      category: AuditCategory.COURSE,
      action: AuditAction.COURSE_IMPORT,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: ObjectId.createFromHexString(created.courseId),
        courseVersionId: ObjectId.createFromHexString(created.versionId),
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {
      courseId: created.courseId,
      versionId: created.versionId,
      name: created.name,
      message: `Course imported successfully as "${created.name}".`,
    };
  }
}

function slugify(value: string): string {
  return (
    (value || 'course')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'course'
  );
}
