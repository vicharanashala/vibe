import {
    IsString,
    IsOptional,
    IsMongoId,
    IsNotEmpty,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsNumber,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';

export class AttemptIdParams {
    @JSONSchema({ description: 'Unique identifier for the attempt', type: 'string' })
    @IsMongoId()
    @IsNotEmpty()
    attemptId: string;
}

export class ResponseItemBody {
    @JSONSchema({ description: 'Id of the question this response answers', type: 'string' })
    @IsString()
    @IsNotEmpty()
    questionId: string;

    @JSONSchema({
        description: 'Selected option id(s), for MCQ (single) / MSQ (multiple) questions',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    selectedOptionIds?: string[];

    @JSONSchema({ description: 'Typed numeric answer, for NAT questions', type: 'string' })
    @IsOptional()
    @IsString()
    natValue?: string;

    @IsOptional()
    @IsBoolean()
    isMarkedForReview?: boolean;

    @IsOptional()
    @IsBoolean()
    isAnswered?: boolean;

    @IsOptional()
    @IsBoolean()
    visited?: boolean;
}

export class ProctoringEventBody {
    @JSONSchema({
        description:
            'Proctoring violation/observation event type, e.g. no-face, multiple-faces, tab-switch',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    type: string;

    @JSONSchema({ description: 'Client epoch-ms timestamp of when the event occurred', type: 'number' })
    @IsNumber()
    at: number;

    @JSONSchema({
        description: 'Optional base64 data URL screenshot captured client-side at the moment of the violation',
        type: 'string',
    })
    @IsOptional()
    @IsString()
    imageDataUrl?: string;
}

export class SubmitAttemptBody {
    @JSONSchema({ description: 'One entry per question in the exam' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ResponseItemBody)
    responses: ResponseItemBody[];

    @JSONSchema({
        description: 'Number of times the student left the exam tab/window',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    tabSwitches?: number;

    @JSONSchema({
        description: 'Client epoch-ms timestamp of when the attempt started',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    startedAt?: number;

    @JSONSchema({ description: 'Proctoring violation events recorded during the attempt' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProctoringEventBody)
    proctoringEvents?: ProctoringEventBody[];
}
