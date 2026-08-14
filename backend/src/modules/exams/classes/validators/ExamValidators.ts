import {
    IsString,
    IsOptional,
    IsMongoId,
    IsNotEmpty,
    IsEnum,
    IsIn,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsNumber,
    Min,
    Matches,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';

const QUESTION_TYPES = ['MCQ', 'MSQ', 'NAT'] as const;
const NEGATIVE_SCHEME_VALUES = [
    'none',
    'one_third',
    'one_fourth',
    'full',
    'custom',
] as const;

export class ExamIdParams {
    @JSONSchema({ description: 'Unique identifier for the exam', type: 'string' })
    @IsMongoId()
    @IsNotEmpty()
    examId: string;
}

export class QuestionIdParams extends ExamIdParams {
    @JSONSchema({ description: 'Unique identifier for the question', type: 'string' })
    @IsString()
    @IsNotEmpty()
    questionId: string;
}

export class TimeGrantIdParams extends ExamIdParams {
    @JSONSchema({ description: 'Unique identifier for the time grant', type: 'string' })
    @IsString()
    @IsNotEmpty()
    grantId: string;
}

export class NegativeMarkingSchemeBody {
    @JSONSchema({ type: 'string', enum: NEGATIVE_SCHEME_VALUES as unknown as string[] })
    @IsIn(NEGATIVE_SCHEME_VALUES)
    MCQ: (typeof NEGATIVE_SCHEME_VALUES)[number];

    @JSONSchema({ type: 'string', enum: NEGATIVE_SCHEME_VALUES as unknown as string[] })
    @IsIn(NEGATIVE_SCHEME_VALUES)
    MSQ: (typeof NEGATIVE_SCHEME_VALUES)[number];

    @JSONSchema({ type: 'string', enum: NEGATIVE_SCHEME_VALUES as unknown as string[] })
    @IsIn(NEGATIVE_SCHEME_VALUES)
    NAT: (typeof NEGATIVE_SCHEME_VALUES)[number];
}

export class ExamProctoringDetectorBody {
    @JSONSchema({
        description:
            'Detector identifier, e.g. cameraMic, blurDetection, faceCountDetection ' +
            '(free string — not coupled to any shared enum)',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    detectorName: string;

    @JSONSchema({ description: 'Whether this detector is enabled for the exam', type: 'boolean' })
    @IsBoolean()
    enabled: boolean;
}

export class ExamProctoringConfigBody {
    @JSONSchema({ description: 'Per-detector proctoring configuration' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExamProctoringDetectorBody)
    detectors: ExamProctoringDetectorBody[];
}

export class TimeGrantSeedBody {
    @JSONSchema({ description: 'Extra minutes granted', type: 'number' })
    @IsNumber()
    @Min(0)
    minutes: number;

    @JSONSchema({ description: 'Reason/note for the grant', type: 'string' })
    @IsOptional()
    @IsString()
    note?: string;
}

export class CreateExamBody {
    @JSONSchema({ description: 'Exam title', type: 'string', example: 'Midterm Exam' })
    @IsString()
    @IsNotEmpty()
    @Matches(/\S/, { message: 'Title cannot be empty or just spaces' })
    title: string;

    @JSONSchema({ description: 'Exam duration in minutes', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number;

    @JSONSchema({ description: 'Minimum marks required to pass', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    passingMarks?: number;

    @JSONSchema({ description: 'Whether negative marking is enabled', type: 'boolean' })
    @IsOptional()
    @IsBoolean()
    negativeMarking?: boolean;

    @JSONSchema({ description: 'Negative marking scheme per question type' })
    @IsOptional()
    @ValidateNested()
    @Type(() => NegativeMarkingSchemeBody)
    negativeMarkingScheme?: NegativeMarkingSchemeBody;

    @JSONSchema({ description: 'Instructions shown before starting the exam', type: 'string' })
    @IsOptional()
    @IsString()
    instructions?: string;

    @JSONSchema({
        description: 'Whether students see correct answers on their result page',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    revealAnswers?: boolean;

    @JSONSchema({ description: 'Per-exam proctoring configuration' })
    @IsOptional()
    @ValidateNested()
    @Type(() => ExamProctoringConfigBody)
    proctoring?: ExamProctoringConfigBody;

    @JSONSchema({ description: 'Initial extra-time grant codes to seed the exam with' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeGrantSeedBody)
    timeGrants?: TimeGrantSeedBody[];

    @JSONSchema({
        description: 'Epoch-ms timestamp after which the exam becomes open. Absent means always open.',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    opensAt?: number;

    @JSONSchema({
        description: 'Epoch-ms timestamp after which the exam closes. Absent means never closes.',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    closesAt?: number;

    @JSONSchema({
        description: 'Whether a student may attempt this exam more than once. Defaults to true.',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    allowRetakes?: boolean;
}

export class UpdateExamBody {
    @JSONSchema({ description: 'Exam title', type: 'string' })
    @IsOptional()
    @IsString()
    @Matches(/\S/, { message: 'Title cannot be empty or just spaces' })
    title?: string;

    @JSONSchema({ description: 'Exam duration in minutes', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number;

    @JSONSchema({ description: 'Minimum marks required to pass', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    passingMarks?: number;

    @JSONSchema({ description: 'Whether negative marking is enabled', type: 'boolean' })
    @IsOptional()
    @IsBoolean()
    negativeMarking?: boolean;

    @JSONSchema({ description: 'Negative marking scheme per question type' })
    @IsOptional()
    @ValidateNested()
    @Type(() => NegativeMarkingSchemeBody)
    negativeMarkingScheme?: NegativeMarkingSchemeBody;

    @JSONSchema({ description: 'Instructions shown before starting the exam', type: 'string' })
    @IsOptional()
    @IsString()
    instructions?: string;

    @JSONSchema({
        description: 'Whether students see correct answers on their result page',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    revealAnswers?: boolean;

    @JSONSchema({ description: 'Per-exam proctoring configuration' })
    @IsOptional()
    @ValidateNested()
    @Type(() => ExamProctoringConfigBody)
    proctoring?: ExamProctoringConfigBody;

    @JSONSchema({
        description:
            'Publish state. Also used as the publish/unpublish toggle: clients ' +
            'send `{ published: true }` (or any other partial patch) to this same ' +
            'endpoint rather than a separate route.',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    published?: boolean;

    @JSONSchema({
        description: 'Epoch-ms timestamp after which the exam becomes open. Absent means always open.',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    opensAt?: number;

    @JSONSchema({
        description: 'Epoch-ms timestamp after which the exam closes. Absent means never closes.',
        type: 'number',
    })
    @IsOptional()
    @IsNumber()
    closesAt?: number;

    @JSONSchema({
        description: 'Whether a student may attempt this exam more than once.',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    allowRetakes?: boolean;
}

export class ExamQuestionOptionBody {
    @JSONSchema({ description: 'Client-generated option id', type: 'string' })
    @IsString()
    @IsNotEmpty()
    id: string;

    @JSONSchema({ description: 'Option text', type: 'string' })
    @IsOptional()
    @IsString()
    text?: string;

    @JSONSchema({ description: 'Optional option image (data URL or URL)', type: 'string' })
    @IsOptional()
    @IsString()
    image?: string;
}

export class AddQuestionBody {
    @JSONSchema({ type: 'string', enum: QUESTION_TYPES as unknown as string[] })
    @IsIn(QUESTION_TYPES)
    type: (typeof QUESTION_TYPES)[number];

    @JSONSchema({ description: 'Question text', type: 'string' })
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @JSONSchema({ description: 'Optional question image (data URL or URL)', type: 'string' })
    @IsOptional()
    @IsString()
    questionImage?: string;

    @JSONSchema({ description: 'Answer options (MCQ/MSQ). Empty for NAT.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExamQuestionOptionBody)
    options?: ExamQuestionOptionBody[];

    @JSONSchema({
        description:
            'Correct answer(s). For MCQ/MSQ these are option ids; for NAT a ' +
            'single-element array holding the numeric answer as a string.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    correctOptions: string[];

    @JSONSchema({ description: 'Marks awarded for a correct answer', type: 'number' })
    @IsNumber()
    @Min(0)
    marks: number;

    @JSONSchema({ description: 'Marks deducted for a wrong answer', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    negativeMarks?: number;

    @JSONSchema({
        description: 'When true, negativeMarks overrides the exam-level scheme for this question',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    useCustomNegative?: boolean;

    @JSONSchema({ description: 'Expected answer format for NAT questions', type: 'string' })
    @IsOptional()
    @IsString()
    natAnswerType?: string;

    @JSONSchema({ description: 'Optional explanation for this question, e.g. shown with results', type: 'string' })
    @IsOptional()
    @IsString()
    explanation?: string;

    @JSONSchema({ description: 'Optional free-text topic tag for this question, e.g. "Graphs"', type: 'string' })
    @IsOptional()
    @IsString()
    topic?: string;
}

export class UpdateQuestionBody {
    @JSONSchema({ type: 'string', enum: QUESTION_TYPES as unknown as string[] })
    @IsOptional()
    @IsIn(QUESTION_TYPES)
    type?: (typeof QUESTION_TYPES)[number];

    @JSONSchema({ description: 'Question text', type: 'string' })
    @IsOptional()
    @IsString()
    questionText?: string;

    @JSONSchema({ description: 'Optional question image (data URL or URL)', type: 'string' })
    @IsOptional()
    @IsString()
    questionImage?: string;

    @JSONSchema({ description: 'Answer options (MCQ/MSQ)' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExamQuestionOptionBody)
    options?: ExamQuestionOptionBody[];

    @JSONSchema({ description: 'Correct answer(s)' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    correctOptions?: string[];

    @JSONSchema({ description: 'Marks awarded for a correct answer', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    marks?: number;

    @JSONSchema({ description: 'Marks deducted for a wrong answer', type: 'number' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    negativeMarks?: number;

    @JSONSchema({
        description: 'When true, negativeMarks overrides the exam-level scheme for this question',
        type: 'boolean',
    })
    @IsOptional()
    @IsBoolean()
    useCustomNegative?: boolean;

    @JSONSchema({ description: 'Expected answer format for NAT questions', type: 'string' })
    @IsOptional()
    @IsString()
    natAnswerType?: string;

    @JSONSchema({ description: 'Optional explanation for this question, e.g. shown with results', type: 'string' })
    @IsOptional()
    @IsString()
    explanation?: string;

    @JSONSchema({ description: 'Optional free-text topic tag for this question, e.g. "Graphs"', type: 'string' })
    @IsOptional()
    @IsString()
    topic?: string;
}

export class BulkAddQuestionsBody {
    @JSONSchema({
        description:
            'Questions to append to the exam in a single call (e.g. CSV import). ' +
            'Same per-question shape/validation as AddQuestionBody.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => AddQuestionBody)
    questions: AddQuestionBody[];
}

export class AddTimeGrantBody {
    @JSONSchema({ description: 'Extra minutes granted', type: 'number' })
    @IsNumber()
    @Min(1)
    minutes: number;

    @JSONSchema({ description: 'Reason/note for the grant', type: 'string' })
    @IsOptional()
    @IsString()
    note?: string;
}

export class RedeemGrantBody {
    @JSONSchema({ description: 'The extra-time grant code to redeem', type: 'string' })
    @IsString()
    @IsNotEmpty()
    code: string;
}
