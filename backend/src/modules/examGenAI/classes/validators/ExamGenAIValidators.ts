import 'reflect-metadata';
import { JSONSchema } from 'class-validator-jsonschema';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsIn,
    IsArray,
    IsMongoId,
} from 'class-validator';

const SUBJECTS = [
    'mathematics',
    'computer_science',
    'chemistry',
    'statistics',
    'physics',
    'economics',
    'other',
] as const;

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'mixed'] as const;

export class GenerateQuestionsBody {
    @JSONSchema({ description: 'Course name', type: 'string' })
    @IsString()
    @IsNotEmpty()
    course_name: string;

    @JSONSchema({ description: 'Subject area — steers the few-shot seed examples', enum: [...SUBJECTS] })
    @IsIn(SUBJECTS)
    subject: (typeof SUBJECTS)[number];

    @JSONSchema({ description: 'Course description', type: 'string' })
    @IsString()
    @IsNotEmpty()
    course_description: string;

    @JSONSchema({ description: 'Syllabus text/outline', type: 'string' })
    @IsString()
    @IsNotEmpty()
    syllabus: string;

    @JSONSchema({ description: 'Past exam / homework content, for style and topic grounding', type: 'string' })
    @IsOptional()
    @IsString()
    past_exam_content?: string;

    @JSONSchema({ description: 'How many of the approved questions to return as the final set', enum: [5, 10, 15] })
    @IsOptional()
    @IsIn([5, 10, 15])
    num_questions?: number;

    @JSONSchema({
        description:
            'Target difficulty band. "mixed" (default) generates broadly and keeps the hardest ' +
            'approved questions. The other three steer generation toward that band and select the ' +
            'closest-to-band-center approved questions instead of always the hardest.',
        enum: [...DIFFICULTY_LEVELS],
    })
    @IsOptional()
    @IsIn(DIFFICULTY_LEVELS)
    difficulty_level?: (typeof DIFFICULTY_LEVELS)[number];
}

export class JobIdParams {
    @IsString()
    @IsNotEmpty()
    jobId: string;
}

const SAVE_TARGETS = ['draft', 'exam', 'bank'] as const;

export class SaveGeneratedQuestionsBody {
    @JSONSchema({
        description:
            'Indices into the job\'s final_questions array to save. Omit to save all of them.',
        type: 'array',
        items: { type: 'number' },
    })
    @IsOptional()
    @IsArray()
    selected_indices?: number[];

    @JSONSchema({
        description:
            '"draft": save unattached (aiGeneratedQuestions collection only). "exam": embed into ' +
            'exam_id\'s question list (exam_id required). "bank": add to the caller\'s question bank.',
        enum: [...SAVE_TARGETS],
    })
    @IsIn(SAVE_TARGETS)
    target: (typeof SAVE_TARGETS)[number];

    @JSONSchema({ description: 'Exam id to attach to — required when target is "exam"', type: 'string' })
    @IsOptional()
    @IsMongoId()
    exam_id?: string;
}
