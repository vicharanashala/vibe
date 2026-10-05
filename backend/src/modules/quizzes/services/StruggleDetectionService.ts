import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {appConfig} from '#root/config/app.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {USERS_TYPES} from '#users/types.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {QUIZZES_TYPES} from '../types.js';
import {
  IQuestionStruggleStreak,
  STRUGGLE_THRESHOLD,
} from '../interfaces/struggle.js';
import type {StruggleStreakRepository} from '../repositories/providers/mongodb/StruggleStreakRepository.js';
import type {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository.js';
import type {IUserRepository} from '#shared/database/interfaces/IUserRepository.js';
import type {ICourseRepository} from '#shared/database/interfaces/ICourseRepository.js';
import type {IItemRepository} from '#shared/database/interfaces/IItemRepository.js';
import type {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import type {NotificationRepository} from '#shared/database/providers/mongo/repositories/NotificationRepository.js';
import type {MailService} from '#root/modules/notifications/services/MailService.js';
import type {INotification} from '#shared/database/interfaces/INotification.js';

/** One graded question from a quiz submission. */
export interface GradedQuestion {
  questionId: {toString(): string};
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
}

export interface QuizResultsInput {
  userId: string;
  courseId: string;
  courseVersionId: string;
  cohortId?: string;
  quizId: string;
  feedback: GradedQuestion[];
}

/** Shown to the student when they keep missing a question. */
export interface SupportNudge {
  /** Questions in this attempt the student has now missed 3+ times in a row. */
  questionCount: number;
  message: string;
}

/** Where a quiz sits in the course, for the alert text. */
interface QuizLocation {
  courseName?: string;
  moduleName?: string;
  sectionName?: string;
  quizName?: string;
}

const NUDGE_MESSAGE =
  "You've attempted this question several times. That's okay, some concepts take time to master. Consider reviewing the lesson before trying again.";
const NUDGE_MESSAGE_PLURAL =
  "You've attempted some of these questions several times. That's okay, some concepts take time to master. Consider reviewing the lesson before trying again.";

/** Keeps long question texts readable in a notification. */
function shorten(text: string, max = 120): string {
  const plain = text.replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/**
 * Real-time struggling student alerts (#1109).
 *
 * Tracks, per student and question, how many times in a row the student
 * answered it wrongly. On the third wrong answer in a row the course's
 * instructors get one in-app notification and an email, and the student gets
 * a supportive nudge. A correct answer resets the streak, so the next run of
 * three wrong answers alerts again.
 */
@injectable()
export class StruggleDetectionService {
  constructor(
    @inject(QUIZZES_TYPES.StruggleStreakRepo)
    private readonly streakRepo: StruggleStreakRepository,

    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepo: QuestionRepository,

    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,

    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(NOTIFICATIONS_TYPES.NotificationRepo)
    private readonly notificationRepo: NotificationRepository,

    @inject(NOTIFICATIONS_TYPES.MailService)
    private readonly mailService: MailService,
  ) {}

  /**
   * Updates the student's streaks from one graded quiz attempt, alerts
   * instructors for any streak that just reached the threshold, and returns
   * a nudge for the student if any question is at or past it.
   *
   * Never throws: a problem here must not affect the quiz submission.
   */
  async recordQuizResults(
    input: QuizResultsInput,
    now: Date = new Date(),
  ): Promise<SupportNudge | undefined> {
    if (!appConfig.ENABLE_STRUGGLE_ALERTS) {
      return undefined;
    }
    try {
      const seen = new Set<string>();
      const struggling: IQuestionStruggleStreak[] = [];
      for (const graded of input.feedback) {
        const questionId = graded.questionId.toString();
        if (seen.has(questionId)) {
          continue;
        }
        seen.add(questionId);
        const key = {
          userId: input.userId,
          courseId: input.courseId,
          courseVersionId: input.courseVersionId,
          cohortId: input.cohortId,
          questionId,
          quizId: input.quizId,
        };
        if (graded.status === 'CORRECT') {
          await this.streakRepo.recordSuccess(key, now);
          continue;
        }
        const streak = await this.streakRepo.recordFailure(key, now);
        if (streak.consecutiveFailures >= STRUGGLE_THRESHOLD) {
          struggling.push(streak);
        }
      }
      if (struggling.length === 0) {
        return undefined;
      }

      const newlyStruggling: IQuestionStruggleStreak[] = [];
      for (const streak of struggling) {
        if (
          !streak.alertedAt &&
          (await this.streakRepo.claimAlert(
            streak._id!,
            STRUGGLE_THRESHOLD,
            now,
          ))
        ) {
          newlyStruggling.push(streak);
        }
      }
      if (newlyStruggling.length > 0) {
        await this.alertInstructors(input, newlyStruggling, now);
      }

      return {
        questionCount: struggling.length,
        message: struggling.length === 1 ? NUDGE_MESSAGE : NUDGE_MESSAGE_PLURAL,
      };
    } catch (error) {
      console.error(
        `[struggleAlerts] Failed to process quiz ${input.quizId} for user ${input.userId}:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Sends one in-app notification per instructor per struggling question,
   * then an email per question to each instructor with an address. Email is
   * best-effort: if mail is not configured, the in-app alert still stands.
   */
  private async alertInstructors(
    input: QuizResultsInput,
    streaks: IQuestionStruggleStreak[],
    now: Date,
  ): Promise<void> {
    const instructorIds = (
      await this.enrollmentRepo.getInstructorIdsByVersion(
        input.courseId,
        input.courseVersionId,
      )
    )
      .map(id => id.toString())
      .filter(id => id !== input.userId);
    if (instructorIds.length === 0) {
      return;
    }

    const [student, questions, location] = await Promise.all([
      this.userRepo.findById(input.userId),
      this.questionRepo.getByIds(streaks.map(s => s.questionId.toString())),
      this.findQuizLocation(input),
    ]);
    const studentName =
      [student?.firstName, student?.lastName].filter(Boolean).join(' ') ||
      student?.email ||
      'A student';
    const questionTitles = new Map(
      questions.map(q => [q._id!.toString(), shorten(q.text)]),
    );
    const where = [location.moduleName, location.sectionName, location.quizName]
      .filter(Boolean)
      .join(' › ');
    const progressLink =
      `${appConfig.frontendUrl}/teacher/courses/enrollments` +
      `?courseId=${input.courseId}&versionId=${input.courseVersionId}&student=${input.userId}`;

    const alerts = streaks.map(streak => {
      const questionId = streak.questionId.toString();
      const title = questionTitles.get(questionId) ?? 'a quiz question';
      const message =
        `${studentName} has answered "${title}" wrongly ` +
        `${streak.consecutiveFailures} times in a row${where ? ` (${where})` : ''}.`;
      return {questionId, title, message, failures: streak.consecutiveFailures};
    });

    const notifications: Omit<INotification, '_id'>[] = instructorIds.flatMap(
      instructorId =>
        alerts.map(alert => ({
          userId: new ObjectId(instructorId),
          type: 'student_struggling' as const,
          title: `${studentName} may need help`,
          message: alert.message,
          courseId: new ObjectId(input.courseId),
          courseVersionId: new ObjectId(input.courseVersionId),
          ...(input.cohortId ? {cohortId: new ObjectId(input.cohortId)} : {}),
          read: false,
          createdAt: now,
          extra: {
            studentId: input.userId,
            studentName,
            questionId: alert.questionId,
            questionTitle: alert.title,
            quizId: input.quizId,
            failureCount: alert.failures,
            courseName: location.courseName,
            moduleName: location.moduleName,
            sectionName: location.sectionName,
            quizName: location.quizName,
          },
        })),
    );
    await this.notificationRepo.createMany(notifications);

    await this.emailInstructors(instructorIds, studentName, alerts, {
      courseName: location.courseName,
      progressLink,
    });
  }

  private async emailInstructors(
    instructorIds: string[],
    studentName: string,
    alerts: {message: string; failures: number}[],
    context: {courseName?: string; progressLink: string},
  ): Promise<void> {
    try {
      const instructors = (
        await this.userRepo.getNamesAndEmailsByIds(instructorIds)
      ).filter(i => i.email);
      const course = context.courseName ? ` in ${context.courseName}` : '';
      for (const instructor of instructors) {
        await this.mailService.sendMail({
          to: instructor.email,
          subject: `${studentName} may need help${course}`,
          text:
            `${alerts.map(a => a.message).join('\n')}\n\n` +
            `View their progress: ${context.progressLink}`,
          html:
            alerts.map(a => `<p>${escapeHtml(a.message)}</p>`).join('') +
            `<p><a href="${escapeHtml(context.progressLink)}">View their progress</a></p>`,
        });
      }
    } catch (error) {
      console.warn(
        '[struggleAlerts] In-app alert sent, but the email could not be sent:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Names of the course, module, section and quiz; empty if not found. */
  private async findQuizLocation(
    input: QuizResultsInput,
  ): Promise<QuizLocation> {
    try {
      const [course, itemsGroup, quizItem] = await Promise.all([
        this.courseRepo.read(input.courseId),
        this.itemRepo.findItemsGroupByItemId(input.quizId),
        this.itemRepo.readItem(input.courseVersionId, input.quizId),
      ]);
      const location: QuizLocation = {
        courseName: course?.name,
        quizName: quizItem?.name,
      };
      if (!itemsGroup?._id) {
        return location;
      }
      const groupId = itemsGroup._id.toString();
      const version = await this.courseRepo.findVersionByItemGroupId(groupId);
      for (const mod of version?.modules ?? []) {
        const section = mod.sections.find(
          s => s.itemsGroupId?.toString() === groupId,
        );
        if (section) {
          return {
            ...location,
            moduleName: mod.name,
            sectionName: section.name,
          };
        }
      }
      return location;
    } catch {
      return {};
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
