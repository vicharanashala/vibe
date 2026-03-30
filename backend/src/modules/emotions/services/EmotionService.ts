import { inject, injectable } from "inversify";
import { EmotionRepository } from "../repositories/EmotionRepository.js";
import {
  IEmotionSubmission,
  EmotionType,
  IEmotionStats,
  EMOTIONS_TYPES,
} from "../types.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { ICourseRepository } from "#shared/database/interfaces/ICourseRepository.js";

@injectable()
export class EmotionService {
  constructor(
    @inject(EMOTIONS_TYPES.EmotionRepository)
    private readonly emotionRepository: EmotionRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepository: ICourseRepository
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
    feedbackText?: string;
    cohortId?: string;
  }): Promise<IEmotionSubmission> {
    const feedbackText = payload.feedbackText?.trim() || undefined;

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
        payload.emotion,
        feedbackText
      );
    }

    // Create new emotion submission
    return await this.emotionRepository.createEmotion({
      studentId: payload.studentId,
      courseId: payload.courseId,
      courseVersionId: payload.courseVersionId,
      itemId: payload.itemId,
      emotion: payload.emotion,
      feedbackText,
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
    const moduleReports = await this.getModuleEmotionReports(courseVersionId, emotions);

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
      modules: moduleReports,
    };
  }

  private createEmptyDistribution(): Record<EmotionType, number> {
    return {
      very_sad: 0,
      sad: 0,
      neutral: 0,
      happy: 0,
      very_happy: 0,
    };
  }

  private createPercentages(emotionCounts: Record<EmotionType, number>, total: number) {
    return {
      very_sad: total > 0 ? (emotionCounts.very_sad / total) * 100 : 0,
      sad: total > 0 ? (emotionCounts.sad / total) * 100 : 0,
      neutral: total > 0 ? (emotionCounts.neutral / total) * 100 : 0,
      happy: total > 0 ? (emotionCounts.happy / total) * 100 : 0,
      very_happy: total > 0 ? (emotionCounts.very_happy / total) * 100 : 0,
    };
  }

  private compareOrder(left?: string, right?: string): number {
    const leftValue = Number(left);
    const rightValue = Number(right);
    const leftIsNumber = Number.isFinite(leftValue);
    const rightIsNumber = Number.isFinite(rightValue);

    if (leftIsNumber && rightIsNumber) {
      return leftValue - rightValue;
    }

    if (left && right) {
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    }

    if (left) {
      return -1;
    }

    if (right) {
      return 1;
    }

    return 0;
  }

  private async getModuleEmotionReports(
    courseVersionId: string,
    courseEmotions: IEmotionSubmission[]
  ) {
    const version = await this.courseRepository.readVersion(courseVersionId);
    const modules = version?.modules || [];

    if (modules.length === 0) {
      return [];
    }

    const moduleToGroupIds: Record<string, string[]> = {};
    const moduleNames: Record<string, string> = {};
    const allItemsGroupIds = new Set<string>();
    const emotionsByItemId = new Map<string, IEmotionSubmission[]>();

    courseEmotions.forEach(emotion => {
      const existing = emotionsByItemId.get(emotion.itemId) || [];
      existing.push(emotion);
      emotionsByItemId.set(emotion.itemId, existing);
    });

    modules.forEach((module: any, index: number) => {
      const moduleId = module?.moduleId?.toString?.() || `module-${index + 1}`;
      const sectionGroupIds = (module?.sections || [])
        .map((section: any) => section?.itemsGroupId?.toString?.())
        .filter((id: string | undefined): id is string => Boolean(id));

      moduleToGroupIds[moduleId] = sectionGroupIds;
      moduleNames[moduleId] = module?.name || `Module ${index + 1}`;
      sectionGroupIds.forEach((groupId: string) => allItemsGroupIds.add(groupId));
    });

    const itemIdsByGroup = await this.emotionRepository.getItemIdsByItemsGroupIds(
      Array.from(allItemsGroupIds)
    );
    const itemRefsByGroup = await this.emotionRepository.getItemRefsByItemsGroupIds(
      Array.from(allItemsGroupIds)
    );

    const reports = Object.keys(moduleToGroupIds).map((moduleId, index) => {
      const moduleItemIds = new Set<string>();
      const moduleItemRefs = new Map<
        string,
        { itemId: string; name: string; type?: string; order?: string }
      >();

      moduleToGroupIds[moduleId].forEach(groupId => {
        (itemIdsByGroup[groupId] || []).forEach(itemId => moduleItemIds.add(itemId));
        (itemRefsByGroup[groupId] || []).forEach(itemRef => {
          if (!moduleItemRefs.has(itemRef.itemId)) {
            moduleItemRefs.set(itemRef.itemId, itemRef);
          }
        });
      });

      const moduleEmotions = courseEmotions.filter(emotion =>
        moduleItemIds.has(emotion.itemId)
      );

      const counts = this.createEmptyDistribution();

      moduleEmotions.forEach(emotion => {
        counts[emotion.emotion] += 1;
      });

      const total = moduleEmotions.length;
      const itemReports = Array.from(moduleItemRefs.values())
        .map((itemRef, itemIndex) => {
          const itemEmotions = emotionsByItemId.get(itemRef.itemId) || [];
          const itemCounts = this.createEmptyDistribution();

          itemEmotions.forEach(emotion => {
            itemCounts[emotion.emotion] += 1;
          });

          const itemTotal = itemEmotions.length;
          const feedbackEntries = itemEmotions
            .filter(emotion => Boolean(emotion.feedbackText?.trim()))
            .sort((left, right) => {
              const leftTime = new Date(
                left.updatedAt || left.createdAt || left.timestamp || 0
              ).getTime();
              const rightTime = new Date(
                right.updatedAt || right.createdAt || right.timestamp || 0
              ).getTime();

              return rightTime - leftTime;
            })
            .map(emotion => ({
              submissionId: emotion._id,
              emotion: emotion.emotion,
              feedbackText: emotion.feedbackText?.trim() || "",
              createdAt: emotion.createdAt,
              updatedAt: emotion.updatedAt,
              timestamp: emotion.timestamp,
            }));

          return {
            itemId: itemRef.itemId,
            itemName: itemRef.name,
            itemType: itemRef.type,
            itemOrder: itemRef.order || `${itemIndex + 1}`,
            total: itemTotal,
            distribution: itemCounts,
            percentages: this.createPercentages(itemCounts, itemTotal),
            averageSentiment: this.calculateAverageSentiment(itemCounts, itemTotal),
            feedbackCount: feedbackEntries.length,
            feedbackEntries,
          };
        })
        .sort((left, right) => {
          const orderDifference = this.compareOrder(left.itemOrder, right.itemOrder);
          if (orderDifference !== 0) {
            return orderDifference;
          }

          return left.itemName.localeCompare(right.itemName, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

      return {
        moduleId,
        moduleOrder: index + 1,
        moduleName: moduleNames[moduleId],
        total,
        itemCount: moduleItemIds.size,
        distribution: counts,
        percentages: this.createPercentages(counts, total),
        averageSentiment: this.calculateAverageSentiment(counts, total),
        items: itemReports,
      };
    });

    return reports;
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
