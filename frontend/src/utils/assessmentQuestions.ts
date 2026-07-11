import { z } from 'zod';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';

const assessmentQuestionTypeSchema = z.enum(['MCQ', 'TRUE_FALSE', 'MULTIPLE_RESPONSE', 'DRAG_AND_DROP', 'DROPDOWN_BLANK']);

export const assessmentQuestionSchema = z.object({
  id: z.string().min(1),
  type: assessmentQuestionTypeSchema,
  questionText: z.string().min(1),
  content: z.object({
    options: z.array(z.string()).optional(),
    correctAnswers: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    dragItems: z.array(z.string()).optional(),
    dropdownOptions: z.record(z.string(), z.array(z.string()).min(1)).optional(),
  }),
});

export function validateAssessmentQuestion(question: AssessmentQuestion) {
  const result = assessmentQuestionSchema.safeParse(question);
  return {
    valid: result.success,
    error: result.success ? null : result.error.flatten().fieldErrors,
  };
}

export function createAssessmentQuestion(type: AssessmentQuestionType): AssessmentQuestion {
  const id = `q-${Math.random().toString(36).slice(2, 10)}`;
  const base: AssessmentQuestion = {
    id,
    type,
    questionText: '',
    content: {},
  };

  switch (type) {
    case 'MCQ':
      return {
        ...base,
        questionText: 'Choose the best answer.',
        content: {
          options: ['Option A', 'Option B', 'Option C'],
          correctAnswers: [0],
        },
      };
    case 'TRUE_FALSE':
      return {
        ...base,
        questionText: 'The statement is true or false.',
        content: {
          options: ['True', 'False'],
          correctAnswers: [0],
        },
      };
    case 'MULTIPLE_RESPONSE':
      return {
        ...base,
        questionText: 'Select all correct answers.',
        content: {
          options: ['Option A', 'Option B', 'Option C'],
          correctAnswers: [0, 2],
        },
      };
    case 'DRAG_AND_DROP':
      return {
        ...base,
        questionText: 'Arrange the concepts in the correct order.',
        content: {
          dragItems: ['First', 'Second', 'Third'],
          correctAnswers: [0, 1, 2],
        },
      };
    case 'DROPDOWN_BLANK':
      return {
        ...base,
        questionText: 'The most important idea is {{blank_1}}.',
        content: {
          dropdownOptions: {
            blank_1: ['clarity', 'speed', 'accuracy'],
          },
        },
      };
    default:
      return base;
  }
}

export function buildAssessmentPromptInstructions(transcript: string) {
  return `You are generating a structured assessment bundle from the latest watched video transcript. Use only the transcript provided below. Return 3-4 questions in JSON. The schema is:
{
  "id": "unique_id",
  "type": "MCQ" | "TRUE_FALSE" | "MULTIPLE_RESPONSE" | "DRAG_AND_DROP" | "DROPDOWN_BLANK",
  "questionText": "Question text or sentence with placeholders",
  "content": {
    "options": ["Array of options for MCQ/MR"],
    "correctAnswers": ["Array of correct indices or values"],
    "dragItems": ["Array of draggable elements"],
    "dropdownOptions": { "blank_1": ["opt1", "opt2"] }
  }
}
Rules:
- Generate 3-4 questions.
- Base every question on the transcript only.
- Keep the JSON valid and ensure the type is one of the five allowed values.
- For dropdowns, use placeholders like {{blank_1}} in questionText and provide dropdownOptions for each blank.
- For true/false, use options ["True", "False"] and correctAnswers [0] or [1].
Transcript:
${transcript}`;
}

export function generateAssessmentQuestionsFromTranscript(transcript: string, count = 3): AssessmentQuestion[] {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  const questions: AssessmentQuestion[] = [];
  const baseText = sentences.join(' ').slice(0, 220);

  const fallbackTypes: AssessmentQuestionType[] = ['MCQ', 'TRUE_FALSE', 'MULTIPLE_RESPONSE', 'DROPDOWN_BLANK'];
  const safeCount = Math.min(count, fallbackTypes.length);

  for (let index = 0; index < safeCount; index += 1) {
    const type = fallbackTypes[index % fallbackTypes.length];
    const question = createAssessmentQuestion(type);
    question.questionText = `${question.questionText}\nTranscript cue: ${baseText}`;
    if (type === 'MCQ') {
      question.content.options = ['Main idea', 'Minor detail', 'Background note'];
      question.content.correctAnswers = [0];
    } else if (type === 'TRUE_FALSE') {
      question.content.options = ['True', 'False'];
      question.content.correctAnswers = [0];
    } else if (type === 'MULTIPLE_RESPONSE') {
      question.content.options = ['Key takeaway', 'Supporting claim', 'Unrelated comment'];
      question.content.correctAnswers = [0, 1];
    } else if (type === 'DROPDOWN_BLANK') {
      question.questionText = 'The central lesson from the video is {{blank_1}}.';
      question.content.dropdownOptions = {
        blank_1: ['actionable', 'irrelevant', 'optional'],
      };
    }
    questions.push(question);
  }

  return questions;
}
