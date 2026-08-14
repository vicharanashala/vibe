import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { STUDENT_QUESTION_TYPES } from '#root/modules/studentQuestions/types.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { ICourseRepository } from '#shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#shared/database/interfaces/IItemRepository.js';
import { StudentQuestionRepository } from '#root/modules/studentQuestions/repositories/providers/mongodb/StudentQuestionRepository.js';
import { InternalServerError, BadRequestError } from 'routing-controllers';
import { IUser } from '#root/shared/interfaces/models.js';

const execFileAsync = promisify(execFile);

@injectable()
export class ChatbotService {
  constructor(
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    private readonly studentQuestionRepo: StudentQuestionRepository,
  ) {}

  private async callPythonChatbot(question: string, context: string): Promise<string> {
    const pythonServiceUrl = process.env.CHATBOT_PYTHON_URL || 'http://127.0.0.1:5001/query';

    // 1. Attempt HTTP request to Python FastAPI microservice
    try {
      const response = await axios.post(
        pythonServiceUrl,
        { question, context },
        { timeout: 15000 }
      );
      if (response.data && response.data.response) {
        return response.data.response;
      }
    } catch (httpErr: any) {
      // If HTTP service is not running, fall back to Python CLI process execution
      console.warn('Python chatbot HTTP service unreachable, falling back to CLI process execution...');
    }

    // 2. Fallback: Execute Python CLI script directly
    try {
      const scriptPath = path.resolve(process.cwd(), 'src/modules/chatbot/python/chatbot_service.py');

      const { stdout } = await execFileAsync(
        'python',
        [scriptPath, '--question', question, '--context', context || '', '--json'],
        {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      const parsed = JSON.parse(stdout);
      if (parsed.response) {
        return parsed.response;
      }
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      return stdout.trim();
    } catch (cliErr: any) {
      console.error('Python chatbot CLI execution failed:', cliErr.message || cliErr);
      throw new InternalServerError(`Failed to query Python AI assistant: ${cliErr.message || cliErr}`);
    }
  }

  async query(user: IUser, question: string): Promise<string> {
    if (!question || !question.trim()) {
      throw new BadRequestError('Question cannot be empty');
    }

    let contextText = '';

    // Best-effort: fetch enrolled course context. If anything fails (DB down,
    // missing transcripts, etc.), we simply skip context and let Gemini answer
    // from general knowledge.
    try {
      const userId = user._id ? user._id.toString() : '';

      if (userId && ObjectId.isValid(userId)) {
        const enrollments = await this.enrollmentRepo.findEnrollments({
          userId: new ObjectId(userId),
          status: 'ACTIVE',
          role: 'STUDENT',
          isDeleted: { $ne: true },
        });

        const contextParts: string[] = [];

        if (enrollments && enrollments.length > 0) {
          const allCourses = await this.courseRepo.getAllCourses();
          const activeCatalog = allCourses.filter(c => !c.isDeleted);
          const courseMap = new Map(activeCatalog.map(c => [c._id.toString(), c.name]));

          const versionIds = enrollments.map(e => e.courseVersionId.toString());
          const activeVersions = await this.courseRepo.getActiveVersions(versionIds);

          for (const activeVersion of activeVersions) {
            if (!activeVersion || activeVersion.isDeleted || !activeVersion.modules) continue;

            const courseName = courseMap.get(activeVersion.courseId.toString()) || 'Enrolled Course';
            contextParts.push(`--- Course: ${courseName} ---`);

            for (const module of activeVersion.modules) {
              if (module.isDeleted || module.isHidden) continue;
              for (const section of module.sections) {
                if (section.isDeleted || section.isHidden) continue;
                const itemsGroupId = section.itemsGroupId;
                if (!itemsGroupId) continue;

                const itemsGroup = await this.itemRepo.readItemsGroup(itemsGroupId.toString()).catch(() => null);
                if (!itemsGroup || !itemsGroup.items) continue;

                for (const item of itemsGroup.items) {
                  if (item.isDeleted || item.isHidden) continue;

                  if (item.type === 'VIDEO') {
                    const transcript = await this.studentQuestionRepo.getSegmentContextText(item._id.toString()).catch(() => null);
                    if (transcript) {
                      contextParts.push(`Lesson/Video: ${item.name}`);
                      contextParts.push(transcript);
                    } else {
                      contextParts.push(`Lesson/Video: ${item.name}`);
                    }
                  } else if (item.type === 'BLOG' || item.type === 'ARTICLE') {
                    const blogDoc = await this.itemRepo.readItemById(item._id.toString()).catch(() => null);
                    if (blogDoc) {
                      contextParts.push(`Article: ${blogDoc.name}`);
                      if (blogDoc.description) contextParts.push(blogDoc.description);
                      if (blogDoc.details?.content) contextParts.push(blogDoc.details.content);
                    }
                  } else {
                    contextParts.push(`Content Item: ${item.name} (${item.type})`);
                  }
                }
              }
            }
          }
        }

        contextText = contextParts.join('\n');
      }
    } catch (ctxErr: any) {
      console.warn('Chatbot: could not load course context (will answer from general knowledge):', ctxErr.message || ctxErr);
    }

    return await this.callPythonChatbot(question, contextText);
  }
}
