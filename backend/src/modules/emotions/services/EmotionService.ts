import { inject, injectable } from "inversify";
import { EmotionRepository } from "../repositories/EmotionRepository.js";
import {
  IEmotionSubmission,
  EmotionType,
  IEmotionStats,
  EMOTIONS_TYPES,
} from "../types.js";

@injectable()
export class EmotionService {
  constructor(
    @inject(EMOTIONS_TYPES.EmotionRepository)
    private readonly emotionRepository: EmotionRepository
  ) {}

  /**
   * Submit emotion for a course item
   */
  async submitEmotion(payload: {
    studentId: string;
    courseId: string;
    courseVersionId: string;
    itemId: string;
    emotion: EmotionType;
    cohortId?: string;
  }): Promise<IEmotionSubmission> {
    // Check if emotion already exists for this student-item pair
    const existing = await this.emotionRepository.getEmotionsByStudentAndItem(
      payload.studentId,
      payload.itemId
    );

    if (existing) {
      // Update existing emotion
      return await this.emotionRepository.updateEmotion(
        payload.studentId,
        payload.itemId,
        payload.emotion
      );
    }

    // Create new emotion submission
    return await this.emotionRepository.createEmotion({
      studentId: payload.studentId,
      courseId: payload.courseId,
      courseVersionId: payload.courseVersionId,
      itemId: payload.itemId,
      emotion: payload.emotion,
      cohortId: payload.cohortId,
      timestamp: new Date(),
    });
  }

  /**
   * Get emotion statistics for an item
   */
  async getItemEmotionStats(itemId: string): Promise<IEmotionStats[]> {
    const stats = await this.emotionRepository.getEmotionStats(itemId);
    const total = stats.reduce((sum, s) => sum + s.count, 0);

    return stats.map((stat) => ({
      itemId,
      emotion: stat._id as EmotionType,
      count: stat.count,
      percentage: total > 0 ? (stat.count / total) * 100 : 0,
    }));
  }

  /**
   * Get emotion history for a student
   */
  async getStudentEmotionHistory(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    limit: number = 50
  ): Promise<IEmotionSubmission[]> {
    return await this.emotionRepository.getEmotionHistory(
      studentId,
      courseId,
      courseVersionId,
      limit
    );
  }

  /**
   * Get overall emotion distribution for a course
   */
  async getCourseEmotionDistribution(courseId: string, courseVersionId: string) {
    return await this.emotionRepository.getEmotionDistribution(courseId, courseVersionId);
  }

  /**
   * Get aggregated emotion data for reporting
   */
  async getEmotionReport(courseId: string, courseVersionId: string) {
    const emotions = await this.emotionRepository.getEmotionsForCourse(courseId, courseVersionId);
    const distribution = await this.getCourseEmotionDistribution(courseId, courseVersionId);

    const total = emotions.length;
    const emotionCounts = {
      very_sad: 0,
      sad: 0,
      neutral: 0,
      happy: 0,
      very_happy: 0,
    };

    distribution.forEach((item: any) => {
      emotionCounts[item._id as EmotionType] = item.count;
    });

    return {
      total,
      distribution: emotionCounts,
      percentages: {
        very_sad: total > 0 ? (emotionCounts.very_sad / total) * 100 : 0,
        sad: total > 0 ? (emotionCounts.sad / total) * 100 : 0,
        neutral: total > 0 ? (emotionCounts.neutral / total) * 100 : 0,
        happy: total > 0 ? (emotionCounts.happy / total) * 100 : 0,
        very_happy: total > 0 ? (emotionCounts.very_happy / total) * 100 : 0,
      },
      averageSentiment: this.calculateAverageSentiment(emotionCounts, total),
    };
  }

  /**
   * Calculate average sentiment score (weighted average)
   * very_sad = -2, sad = -1, neutral = 0, happy = 1, very_happy = 2
   */
  private calculateAverageSentiment(emotionCounts: Record<EmotionType, number>, total: number): number {
    if (total === 0) return 0;

    const sentimentScores = {
      very_sad: -2,
      sad: -1,
      neutral: 0,
      happy: 1,
      very_happy: 2,
    };

    let totalScore = 0;
    (Object.keys(emotionCounts) as EmotionType[]).forEach((emotion) => {
      totalScore += emotionCounts[emotion] * sentimentScores[emotion];
    });

    return totalScore / total;
  }
}
