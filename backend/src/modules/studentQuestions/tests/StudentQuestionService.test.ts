import {describe, expect, it, vi, beforeEach} from 'vitest';
import {StudentQuestionService} from '../services/StudentQuestionService.js';

describe('StudentQuestionService', () => {
  const baseInput = {
    courseId: '65b7c8c8c8c8c8c8c8c8c8c8',
    courseVersionId: '65b7c8c8c8c8c8c8c8c8c8c9',
    segmentId: '65b7c8c8c8c8c8c8c8c8c8ca',
    createdBy: '65b7c8c8c8c8c8c8c8c8c8cb',
    questionType: 'SELECT_ONE_IN_LOT' as const,
    questionText: 'Why do we need sorted input for binary search?',
    options: [
      {text: 'It helps us repeatedly halve the search space.'},
      {text: 'It makes the array easier to print.'},
      {text: 'It is required only for linked lists.'},
    ],
    correctOptionIndex: 0,
  };

  const repository = {
    findDuplicate: vi.fn(),
    create: vi.fn(),
  };

  const settingRepo = {
    readCourseSettings: vi.fn(),
  };

  let service: StudentQuestionService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new StudentQuestionService(repository as any, settingRepo as any);
  });

  it('rejects submissions when feature flag is disabled', async () => {
    settingRepo.readCourseSettings.mockResolvedValue({
      settings: {crowdsourcedQuestionSubmissionEnabled: false},
    });

    await expect(service.createQuestion(baseInput)).rejects.toThrow(
      'Question submission is not enabled for this course version.',
    );
  });

  it('rejects URL-only question text', async () => {
    settingRepo.readCourseSettings.mockResolvedValue({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    });

    await expect(
      service.createQuestion({...baseInput, questionText: 'https://example.com'}),
    ).rejects.toThrow('Question cannot contain only URLs.');
  });

  it('rejects MCQ submissions with fewer than two options', async () => {
    settingRepo.readCourseSettings.mockResolvedValue({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    });

    await expect(
      service.createQuestion({...baseInput, options: [{text: 'Only one option'}]}),
    ).rejects.toThrow('MCQ submissions must include between 2 and 8 options.');
  });

  it('rejects duplicate questions in the same segment', async () => {
    settingRepo.readCourseSettings.mockResolvedValue({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    });
    repository.findDuplicate.mockResolvedValue({
      _id: 'existing-question-id',
    });

    await expect(service.createQuestion(baseInput)).rejects.toThrow(
      'A similar question already exists for this segment.',
    );
  });

  it('stores V1 metadata when valid submission is created', async () => {
    settingRepo.readCourseSettings.mockResolvedValue({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    });
    repository.findDuplicate.mockResolvedValue(null);
    repository.create.mockResolvedValue('new-question-id');

    const id = await service.createQuestion(baseInput);

    expect(id).toBe('new-question-id');
    expect(repository.create).toHaveBeenCalledTimes(1);
    const payload = repository.create.mock.calls[0][0];
    expect(payload.status).toBe('UNVERIFIED');
    expect(payload.source).toBe('STUDENT_GENERATED');
    expect(payload.questionType).toBe('SELECT_ONE_IN_LOT');
    expect(payload.questionText).toBe(baseInput.questionText);
    expect(payload.options).toEqual(baseInput.options);
    expect(payload.correctOptionIndex).toBe(0);
  });
});
