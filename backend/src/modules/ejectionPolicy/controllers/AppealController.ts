import 'reflect-metadata';
import {
  JsonController,
  Post,
  Get,
  Body,
  Param,
  Authorized,
  CurrentUser,
  QueryParams,
  HttpCode,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {OpenAPI} from 'routing-controllers-openapi';
import {IsMongoId, IsOptional, IsString} from 'class-validator';

import {AppealService} from '../services/AppealService.js';
import {EJECTION_POLICY_TYPES} from '../types.js';

// ================= DTOs =================

class CreateAppealBody {
  @IsMongoId()
  courseId: string;

  @IsMongoId()
  courseVersionId: string;

  @IsMongoId()
  cohortId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

class RejectAppealBody {
  @IsString()
  reason: string;
}

class GetAppealsQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  courseVersionId?: string;

  @IsOptional()
  @IsMongoId()
  cohortId?: string;
}

// ================= CONTROLLER =================

@OpenAPI({tags: ['Appeals']})
@JsonController('/appeals')
@injectable()
export class AppealController {
  constructor(
    @inject(EJECTION_POLICY_TYPES.AppealService)
    private readonly appealService: AppealService,
  ) {}

  // ================= CREATE =================

  @Authorized()
  @Post('/')
  @HttpCode(200)
  async createAppeal(@Body() body: CreateAppealBody, @CurrentUser() user: any) {
    return this.appealService.createAppeal(
      user._id.toString(),
      body.courseId,
      body.courseVersionId,
      body.cohortId,
      body.reason,
      body.evidenceUrl,
    );
  }

  // ================= GET =================

  @Authorized()
  @Get('/')
  async getAppeals(@QueryParams() query: GetAppealsQuery) {
    const appeals = await this.appealService.getAppeals(query);
    return appeals.map(a => ({
      _id: a._id?.toString(),
      userId: a.userId?.toString(),
      courseId: a.courseId?.toString(),
      courseVersionId: a.courseVersionId?.toString(),
      cohortId: a.cohortId?.toString(),
      policyId: a.policyId?.toString(),
      reason: a.reason,
      evidenceUrl: a.evidenceUrl,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      reviewedBy: a.reviewedBy?.toString(),
      reviewedAt: a.reviewedAt,
      adminResponse: a.adminResponse,
    }));
  }

  @Get('/:id')
  @Authorized()
  async getAppealById(@Param('id') id: string) {
    const a = await this.appealService.getAppealById(id);
    if (!a) return null;
    return {
      _id: a._id?.toString(),
      userId: a.userId?.toString(),
      courseId: a.courseId?.toString(),
      courseVersionId: a.courseVersionId?.toString(),
      cohortId: a.cohortId?.toString(),
      policyId: a.policyId?.toString(),
      reason: a.reason,
      evidenceUrl: a.evidenceUrl,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      reviewedBy: a.reviewedBy?.toString(),
      reviewedAt: a.reviewedAt,
      adminResponse: a.adminResponse,
    };
  }

  // ================= APPROVE =================

  @Authorized()
  @Post('/:id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    await this.appealService.approveAppeal(id, user._id.toString());
    return {message: 'Appeal approved'};
  }

  // ================= REJECT =================

  @Authorized()
  @Post('/:id/reject')
  @HttpCode(200)
  async reject(
    @Param('id') id: string,
    @Body() body: RejectAppealBody,
    @CurrentUser() user: any,
  ) {
    await this.appealService.rejectAppeal(id, user._id.toString(), body.reason);
    return {message: 'Appeal rejected'};
  }
}
