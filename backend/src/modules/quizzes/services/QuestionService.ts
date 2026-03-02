import {injectable, inject} from 'inversify';
import {NotFoundError, BadRequestError} from 'routing-controllers';
import {QUIZZES_TYPES} from '../types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository.js';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository.js';
import {AttemptRepository} from '../repositories/providers/mongodb/AttemptRepository.js';
import {UserQuizMetricsRepository} from '../repositories/providers/mongodb/UserQuizMetricsRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ParameterMap} from '../question-processing/tag-parser/tags/Tag.js';
import {BaseQuestion} from '../classes/transformers/Question.js';
import {IQuestionRenderView} from '../question-processing/renderers/interfaces/RenderViews.js';
import {QuestionProcessor} from '../question-processing/QuestionProcessor.js';
import {QuizRepository} from '../repositories/providers/mongodb/QuizRepository.js';
import {ClientSession, ObjectId} from 'mongodb';
import {aiConfig} from '#root/config/ai.js';
import {Anthropic} from '@anthropic-ai/sdk';
import {TranscriptResponse} from '#root/shared/index.js';
import JSON5 from 'json5';

@injectable()
class QuestionService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,

    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private questionBankRepository: QuestionBankRepository,

    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,
    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepository: UserQuizMetricsRepository,

    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepository: QuizRepository,

    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase, // Replace with actual database type if needed
  ) {
    super(database);
  }

  private async _getQuestionSkipCount(
    questionId: string | ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    try {
      // Step 1: get bank IDs linked to this question
      const questionBanks =
        await this.questionBankRepository.getQuestionBanksByQuestionId(
          questionId,
          session,
        );

      if (!questionBanks?.length) return 0;

      const questionBankIds = questionBanks
        .map(bank => bank._id?.toString())
        .filter((id): id is string => Boolean(id));

      if (!questionBankIds.length) return 0;

      // Step 2: find all quizzes that allow skip & reference these banks
      const quizzes = await this.quizRepository.findSkipAllowedQuizzes(
        questionBankIds,
        session,
      );

      if (!quizzes?.length) return 0;

      const quizIds = quizzes.map(q => q._id);

      // Step 3: get all userQuizMetrics for those quizzes
      const metrics = await this.userQuizMetricsRepository.getByQuizIds(
        quizIds,
        session,
      );

      // Step 4: sum skip counts
      const totalSkipCount = metrics.reduce(
        (sum, m) => sum + (m.skipCount || 0),
        0,
      );

      return totalSkipCount;
    } catch (error) {
      console.error('Error calculating question skip count:', error);
      return 0;
    }
  }

  public async create(question: BaseQuestion): Promise<string> {
    return this._withTransaction(async session => {
      return await this.questionRepository.create(question, session);
    });
  }


  public async getById(
    questionId: string | ObjectId,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      const [attemptCount, attemptedByUsersCount] = await Promise.all([
        this.attemptRepository.countByQuestionId(questionId, session),
        this.attemptRepository.countDistinctUsersByQuestionId(
          questionId,
          session,
        ),
      ]);

      if (raw) {
        const skipCount = await this._getQuestionSkipCount(questionId, session);

        return {
          ...(question as BaseQuestion),
          attemptCount,
          attemptedByUsersCount,
          skipCount,
        } as unknown as BaseQuestion;
      }

      const questionProcessor = new QuestionProcessor(question);
      const rendered = questionProcessor.render(
        parameterMap,
      ) as IQuestionRenderView;

      return {
        ...rendered,
        attemptCount,
        attemptedByUsersCount,
      };
    });
  }
  public async getByIdWithoutExplanation(
    questionId: string,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getByIdWithoutExplanation(
        questionId,
        session,
      );

      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      const [attemptCount, attemptedByUsersCount] = await Promise.all([
        this.attemptRepository.countByQuestionId(questionId, session),
        this.attemptRepository.countDistinctUsersByQuestionId(
          questionId,
          session,
        ),
      ]);

      if (raw) {
        const skipCount = await this._getQuestionSkipCount(questionId, session);

        return {
          ...(question as BaseQuestion),
          attemptCount,
          attemptedByUsersCount,
          skipCount,
        } as unknown as BaseQuestion;
      }

      const questionProcessor = new QuestionProcessor(question);
      const rendered = questionProcessor.render(
        parameterMap,
      ) as IQuestionRenderView;

      return {
        ...rendered,
        attemptCount,
        attemptedByUsersCount,
      };
    });
  }

  public async update(
    questionId: string,
    updatedQuestion: BaseQuestion,
  ): Promise<BaseQuestion | null> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }
      if (question.type !== updatedQuestion.type) {
        throw new BadRequestError(
          `Cannot change question type from ${question.type} to ${updatedQuestion.type}`,
        );
      }
      const {_id, ...questionData} = updatedQuestion;
      const updated = await this.questionRepository.update(
        questionId,
        questionData,
        session,
      );
      updated._id = updated._id.toString();
      return updated;
    });
  }

  public async delete(questionId: string): Promise<void> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      // Remove question from all banks (Soft deletion preserve references)
      /*await this.questionBankRepository.removeQuestionFromAllBanks(
        questionId,
        session,
      );*/

      // Delete the question
      await this.questionRepository.delete(questionId, session);
    });
  }

  public async flagQuestion(
    questionId: string,
    userId: string,
    reason: string,
    courseId?: string,
    versionId?: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      // Flag the question with the reason and user ID
      await this.questionRepository.flagQuestion(
        questionId,
        userId,
        reason,
        session,
        courseId,
        versionId,
      );
    });
  }

  public async resolveFlaggedQuestion(
    flagId: string,
    userId: string,
    status: 'RESOLVED' | 'REJECTED',
  ): Promise<void> {
    return this._withTransaction(async session => {
      const flaggedQuestion =
        await this.questionRepository.getFlaggedQuestionById(flagId, session);
      if (!flaggedQuestion) {
        throw new NotFoundError(`Flagged question not found`);
      }

      // Update the flagged question status and resolvedBy
      await this.questionRepository.updateFlaggedQuestion(
        flagId,
        {status, resolvedBy: userId, resolvedAt: new Date()},
        session,
      );
    });
  }

  public async generateQuestionsWithAI(
    userId: string,
    text: string,
  ): Promise<TranscriptResponse[]> {
    return this._withTransaction(async session => {
      try {
        if (!text || text.trim().length === 0) {
          throw new BadRequestError('Input text cannot be empty');
        }

        const prompt = `
    You are an expert MERN stack educator and question-generation specialist. You will generate high-quality Multiple Choice Questions (MCQs) based ONLY on the provided video transcript text.

    Your response MUST follow these rules:

    ================================
    OUTPUT FORMAT (STRICT JSON)
    ================================

    Return a JSON object with this EXACT structure:

    {
      "segments": [
        {
          "segmentNumber": number,
          "timestamp": "mm:ss",
          "questions": [
            {
              "sno": number,
              "question": "string",
              "hint": "string",
              "options": {
                "A": "string",
                "B": "string",
                "C": "string",
                "D": "string"
              },
              "explanations": {
                "A": "string",
                "B": "string",
                "C": "string",
                "D": "string"
              },
              "correctAnswer": "A" | "B" | "C" | "D"
            }
          ]
        }
      ]
    }

    Important JSON constraints:
    - No markdown formatting
    - No trailing commas
    - No extra fields outside the schema
    - MUST be valid JSON that can be parsed directly
    - Every field must be present and always a string where required

    ================================
    CONTENT RULES
    ================================

    1. Conceptual Understanding Only
    - Test reasoning, workflows, logic, architecture
    - No trivia, no direct quoting, no timestamps or speaker names

    2. No Memorization Questions
    - Avoid dates, random numbers, or historical facts

    3. Paraphrasing Rule
    - All content must be rewritten in your own words

    4. Options Design
    - All 4 answer options must be believable and similar in length
    - No obviously wrong distractors

    5. Hint Formatting
    - Refer to "the video"
    - 1–2 sentences guiding thought, not revealing the answer

    6. Explanation Quality
    - Explain WHY each option is correct or incorrect
    - Reference concepts from "the video"

    7. Code-related Questions
    - Only the "question" field may include code
    - Use "\\n" for each new line inside the code
    - Options/explanations must NOT contain "\\n"

    ================================
    TIMESTAMP RULES (VERY IMPORTANT)
    ================================
    - The transcript contains timestamps in this format:
      HH;MM;SS;MS - HH;MM;SS;MS
      Example: 00;00;02;07 - 00;00;30;05
    - For each segment, ALWAYS extract the SECOND timestamp (the end time)
    - Convert this to "MM:SS" format
      Example: "00;00;30;05" → "00:30"
    - The "timestamp" must be only the converted end time (MM:SS)
    - No milliseconds, no hours, no semicolons
    - One timestamp per segment only
    - Each timestamp segment should contain 3–6 questions

    ================================
    FAIL-SAFE VALIDATION RULE
    ================================
    Before generating JSON:
    If no transcript text is provided, respond ONLY with:
    "Please provide the transcript or upload a .txt file."

    ================================
    FINAL REQUIREMENT
    ================================
    Return ONLY the JSON object. No additional text, comments, formatting, or explanation.
        `;

        const ANTHROPIC_CRED = aiConfig.ANTHROPIC_CRED;
        const ANTHROPIC_MODEL = aiConfig.ANTHROPIC_MODEL;

        if (!ANTHROPIC_CRED) {
          throw new BadRequestError('Failed to find api key, try again!');
        }

        const anthropic = new Anthropic({
          apiKey: ANTHROPIC_CRED!,
        });

        const response = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 4000,
          temperature: 0.0,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${prompt}\n\nTRANSCRIPT:\n${text}`,
                },
              ],
            },
          ],
        });

        const finalOutput =
          response.content?.map(c => ('text' in c ? c.text : '')).join('') ??
          '';

        // Remove trailing commas in objects/arrays (common AI mistake)
        let cleanedOutput = finalOutput.replace(/,\s*([}\]])/g, '$1');

        // Optionally, remove code fences (if AI adds ```json)
        cleanedOutput = cleanedOutput.replace(/```json|```/gi, '').trim();

        // Parse using JSON5 for robustness
        let parsed;
        try {
          parsed = JSON5.parse(cleanedOutput);
        } catch (err) {
          console.error('Failed to parse JSON from AI output:', cleanedOutput);
          throw new BadRequestError(
            'AI returned invalid JSON. Try reducing transcript size or split into smaller chunks.',
          );
        }

        return parsed.segments;
      } catch (error: any) {
        console.error('Error generating questions with AI:', error);

        throw new BadRequestError(
          error?.message || 'Failed to generate questions from AI',
        );
      }
    });
  }
}

export {QuestionService};
