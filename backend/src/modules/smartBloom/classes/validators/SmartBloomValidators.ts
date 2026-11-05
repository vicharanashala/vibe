import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

/** Every direct route is scoped to a course version so permission can be checked. */
class VersionScoped {
  @JSONSchema({description: 'Course version the content is being prepared for'})
  @IsMongoId()
  versionId: string;
}

export class TranscriptBody extends VersionScoped {
  @JSONSchema({
    description:
      'Transcript text in any layout with timestamps: pasted from YouTube\'s "Show transcript" panel or read from a file (the page extracts text from .docx/.xlsx first)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000_000)
  content: string;
}

export class SegmentBody extends VersionScoped {
  @JSONSchema({
    description: 'Transcript chunks: [{timestamp: [start, end], text}]',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50_000)
  chunks: Array<{timestamp: [number, number]; text: string}>;

  @IsIn(['DEFAULT', 'CONCEPT_END'])
  strategy: 'DEFAULT' | 'CONCEPT_END';

  @JSONSchema({description: 'Shortest allowed segment, in seconds'})
  @IsNumber()
  @Min(30)
  @Max(1800)
  minSegmentSeconds: number;
}

export class QuestionsBody extends VersionScoped {
  @IsInt()
  @Min(1)
  segmentNumber: number;

  @IsNumber()
  @Min(0)
  startSeconds: number;

  @IsNumber()
  @Min(0)
  endSeconds: number;

  @JSONSchema({description: 'Transcript text of this segment only'})
  @IsString()
  @IsNotEmpty()
  @MaxLength(200_000)
  segmentText: string;

  @JSONSchema({
    description: 'Questions wanted per Bloom level, e.g. {"knowledge": 5}',
  })
  @IsObject()
  bloomTargets: Record<string, number>;

  @JSONSchema({
    description: 'Allowed question type codes: SOL, SML, BIN, NAT, DES',
  })
  @IsArray()
  @IsIn(['SOL', 'SML', 'BIN', 'NAT', 'DES'], {each: true})
  questionTypes: string[];

  @JSONSchema({
    description:
      "The instructor's generation instructions from the Smart Bloom page",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  instructions?: string;
}

export class UploadBody extends VersionScoped {
  @IsMongoId()
  moduleId: string;

  @IsMongoId()
  sectionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  videoUrl: string;

  @JSONSchema({description: 'Segment END times in seconds, in order'})
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, {each: true})
  segmentMap: number[];

  @JSONSchema({
    description:
      'Curated questions, each tagged with its segment END time as segmentId',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5000)
  questions: any[];

  @IsOptional()
  @IsObject()
  distribution?: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  videoItemBaseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  quizItemBaseName?: string;
}

export const SMART_BLOOM_VALIDATORS = [
  TranscriptBody,
  SegmentBody,
  QuestionsBody,
  UploadBody,
];
