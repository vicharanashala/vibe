import {Type} from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

export class AnalyticsVersionParams {
  @IsMongoId()
  courseId: string;

  @IsMongoId()
  versionId: string;
}

export class CourseInsightsQuery {
  @JSONSchema({
    description: 'Range in days: 7, 30 or 90 (default 30).',
    enum: [7, 30, 90],
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  range?: 7 | 30 | 90;
}

const nullableNumber = {type: ['number', 'null'] as any};

export class InsightsMetric {
  @JSONSchema(nullableNumber)
  @IsOptional()
  @IsNumber()
  current: number | null;

  @JSONSchema(nullableNumber)
  @IsOptional()
  @IsNumber()
  previous: number | null;
}

export class InsightsHeadline {
  @ValidateNested() @Type(() => InsightsMetric) students: InsightsMetric;
  @ValidateNested() @Type(() => InsightsMetric) activeThisWeek: InsightsMetric;
  @JSONSchema({description: 'Average progress in percent, 0–100.'})
  @ValidateNested()
  @Type(() => InsightsMetric)
  averageProgress: InsightsMetric;
  @ValidateNested() @Type(() => InsightsMetric) finished: InsightsMetric;
  @ValidateNested() @Type(() => InsightsMetric) medianDaysToFinish: InsightsMetric;
  @ValidateNested() @Type(() => InsightsMetric) learningHours: InsightsMetric;
}

export class InsightsDailyRow {
  @JSONSchema({description: 'IST day, YYYY-MM-DD'}) @IsString() day: string;
  @IsNumber() activeLearners: number;
  @IsNumber() learningHours: number;
  @IsNumber() newEnrolments: number;
}

export class InsightsProgressBand {
  @IsIn(['0', '1-24', '25-49', '50-74', '75-99', 'finished'])
  band: '0' | '1-24' | '25-49' | '50-74' | '75-99' | 'finished';
  @IsNumber() students: number;
}

export class InsightsFunnelRow {
  @IsString() moduleId: string;
  @IsString() name: string;
  @IsNumber() reached: number;
  @IsNumber() completed: number;
}

export class InsightsWhereNowRow {
  @IsString() itemId: string;
  @IsString() moduleId: string;
  @IsString() sectionId: string;
  @IsString() name: string;
  @IsString() type: string;
  @IsNumber() students: number;
  @IsNumber() medianDaysThere: number;
}

export class InsightsHardestQuestion {
  @IsString() questionId: string;
  @IsString() text: string;
  @JSONSchema({description: 'Share answered correctly on first attempts, 0–1.'})
  @IsNumber()
  correctRate: number;
  @IsNumber() answered: number;
}

export class InsightsQuizRow {
  @IsString() itemId: string;
  @IsString() moduleId: string;
  @IsString() sectionId: string;
  @IsString() name: string;
  @IsNumber() attempted: number;
  @JSONSchema({...nullableNumber, description: '0–1'})
  @IsOptional()
  @IsNumber()
  firstAttemptPassRate: number | null;
  @JSONSchema(nullableNumber)
  @IsOptional()
  @IsNumber()
  avgAttemptsToPass: number | null;
  @JSONSchema({
    description: '10 bands of first-attempt score %: 0–9, 10–19, … 90–100.',
  })
  @IsArray()
  @IsNumber({}, {each: true})
  scoreBands: number[];
  @ValidateNested({each: true})
  @Type(() => InsightsHardestQuestion)
  hardestQuestions: InsightsHardestQuestion[];
}

export class InsightsRewindHotspot {
  @IsNumber() startSecond: number;
  @IsNumber() rewinds: number;
}

export class InsightsVideoRow {
  @IsString() itemId: string;
  @IsString() moduleId: string;
  @IsString() sectionId: string;
  @IsString() name: string;
  @IsNumber() started: number;
  @IsNumber() completed: number;
  @ValidateNested({each: true})
  @Type(() => InsightsRewindHotspot)
  rewindHotspots: InsightsRewindHotspot[];
}

export class InsightsCheckOnItem {
  @IsString() itemId: string;
  @IsString() name: string;
}

export class InsightsCheckOnRow {
  @IsString() userId: string;
  @IsString() name: string;
  @IsString() email: string;
  @IsIn(['inactive', 'stuck']) reason: 'inactive' | 'stuck';
  @IsNumber() daysSinceActive: number;
  @JSONSchema({
    anyOf: [{$ref: '#/components/schemas/InsightsCheckOnItem'}, {type: 'null'}],
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InsightsCheckOnItem)
  item: InsightsCheckOnItem | null;
  @JSONSchema(nullableNumber)
  @IsOptional()
  @IsNumber()
  daysOnItem: number | null;
}

export class InsightsProctoringDay {
  @IsString() day: string;
  @JSONSchema({
    type: 'object',
    additionalProperties: {type: 'number'},
    description: 'Incidents per 100 learning hours, keyed by anomaly type.',
  })
  per100Hours: Record<string, number>;
}

export class InsightsProctoring {
  @IsBoolean() checksOn: boolean;
  @ValidateNested({each: true})
  @Type(() => InsightsProctoringDay)
  daily: InsightsProctoringDay[];
  @JSONSchema({description: '0–1'}) @IsNumber() shareWithIncident: number;
}

export class InsightsStudyMode {
  @IsNumber() strictOnly: number;
  @IsNumber() studyOnly: number;
  @IsNumber() both: number;
}

export class CourseInsightsResponse {
  @IsIn(['ready', 'building']) status: 'ready' | 'building';

  @JSONSchema({type: ['string', 'null'] as any, format: 'date-time'})
  @IsOptional()
  @IsString()
  updatedAt: string | null;

  @IsIn([7, 30, 90]) range: 7 | 30 | 90;

  @IsOptional() @ValidateNested() @Type(() => InsightsHeadline)
  headline?: InsightsHeadline;

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsDailyRow)
  daily?: InsightsDailyRow[];

  @JSONSchema({
    type: 'array',
    items: {type: 'array', items: {type: 'number'}},
    description: '[weekday 0=Mon..6=Sun][hour 0..23] learning hours, IST',
  })
  @IsOptional()
  heatmap?: number[][];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsProgressBand)
  progressBands?: InsightsProgressBand[];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsFunnelRow)
  funnel?: InsightsFunnelRow[];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsWhereNowRow)
  whereNow?: InsightsWhereNowRow[];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsQuizRow)
  quizzes?: InsightsQuizRow[];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsVideoRow)
  videos?: InsightsVideoRow[];

  @IsOptional() @ValidateNested({each: true}) @Type(() => InsightsCheckOnRow)
  checkOn?: InsightsCheckOnRow[];

  @IsOptional() @ValidateNested() @Type(() => InsightsProctoring)
  proctoring?: InsightsProctoring;

  @IsOptional() @ValidateNested() @Type(() => InsightsStudyMode)
  studyMode?: InsightsStudyMode;
}

export class RebuildAcceptedResponse {
  @IsBoolean() accepted: boolean;
}

export const ANALYTICS_VALIDATORS: Function[] = [
  AnalyticsVersionParams,
  CourseInsightsQuery,
  InsightsMetric,
  InsightsHeadline,
  InsightsDailyRow,
  InsightsProgressBand,
  InsightsFunnelRow,
  InsightsWhereNowRow,
  InsightsHardestQuestion,
  InsightsQuizRow,
  InsightsRewindHotspot,
  InsightsVideoRow,
  InsightsCheckOnItem,
  InsightsCheckOnRow,
  InsightsProctoringDay,
  InsightsProctoring,
  InsightsStudyMode,
  CourseInsightsResponse,
  RebuildAcceptedResponse,
];
