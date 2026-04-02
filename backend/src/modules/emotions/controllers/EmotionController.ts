import {
  Body,
  CurrentUser,
  Get,
  HttpCode,
  Post,
  Authorized,
  JsonController,
  Param,
} from "routing-controllers";
import { OpenAPI } from "routing-controllers-openapi";
import { injectable, inject } from "inversify";
import { EmotionService } from "../services/EmotionService.js";
import { EMOTIONS_TYPES } from "../types.js";

interface SubmitEmotionBody {
  courseId: string;
  courseVersionId: string;
  itemId: string;
  emotion: "very_sad" | "sad" | "neutral" | "happy" | "very_happy";
  feedbackText?: string;
  cohortId?: string;
}

@OpenAPI({
  tags: ["Emotions"],
})
@injectable()
@JsonController("/emotions")
class EmotionController {
  constructor(
    @inject(EMOTIONS_TYPES.EmotionService)
    private readonly emotionService: EmotionService
  ) {}

  @OpenAPI({
    summary: "Submit emotion for a course item",
    description:
      "Records a learner's emotional response to a course item (video, article, quiz, etc.)",
  })
  @Authorized()
  @Post("/submit")
  @HttpCode(200)
  async submitEmotion(
    @Body() body: SubmitEmotionBody,
    @CurrentUser() user: { _id: string }
  ) {
    const { courseId, courseVersionId, itemId, emotion, feedbackText, cohortId } = body;
    const studentId = user?._id?.toString();

    if (!studentId) {
      return {
        success: false,
        message: "User not authenticated",
      };
    }

    try {
      const result = await this.emotionService.submitEmotion({
        studentId,
        courseId,
        courseVersionId,
        itemId,
        emotion,
        feedbackText,
        cohortId,
      });

      return {
        success: true,
        message: "Emotion recorded successfully",
        data: result,
      };
    } catch (error: any) {
      console.error("Error submitting emotion:", error);
      return {
        success: false,
        message: error.message || "Failed to submit emotion",
      };
    }
  }

  @OpenAPI({
    summary: "Get emotion statistics for an item",
    description: "Retrieves aggregated emotion data for a specific course item",
  })
  @Get("/stats/:itemId")
  @HttpCode(200)
  async getItemEmotionStats(@Param("itemId") itemId: string) {
    try {
      const stats = await this.emotionService.getItemEmotionStats(itemId);

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error("Error fetching emotion stats:", error);
      return {
        success: false,
        message: error.message || "Failed to fetch emotion statistics",
      };
    }
  }

  @OpenAPI({
    summary: "Get learner's emotion history",
    description:
      "Retrieves a learner's emotional responses for items in a specific course",
  })
  @Authorized()
  @Get("/history/:courseId/:courseVersionId")
  @HttpCode(200)
  async getEmotionHistory(
    @Param("courseId") courseId: string,
    @Param("courseVersionId") courseVersionId: string,
    @CurrentUser() user: { _id: string }
  ) {
    const studentId = user?._id?.toString();

    if (!studentId) {
      return {
        success: false,
        message: "User not authenticated",
      };
    }

    try {
      const history = await this.emotionService.getStudentEmotionHistory(
        studentId,
        courseId,
        courseVersionId,
        50
      );

      return {
        success: true,
        data: history,
      };
    } catch (error: any) {
      console.error("Error fetching emotion history:", error);
      return {
        success: false,
        message: error.message || "Failed to fetch emotion history",
      };
    }
  }

  @OpenAPI({
    summary: "Get emotion report for a course",
    description:
      "Retrieves aggregated emotion analytics for all learners in a course",
  })
  @Get("/report/:courseId/:courseVersionId")
  @HttpCode(200)
  async getCourseEmotionReport(
    @Param("courseId") courseId: string,
    @Param("courseVersionId") courseVersionId: string
  ) {
    try {
      const report = await this.emotionService.getEmotionReport(
        courseId,
        courseVersionId
      );

      return {
        success: true,
        data: report,
      };
    } catch (error: any) {
      console.error("Error fetching emotion report:", error);
      return {
        success: false,
        message: error.message || "Failed to fetch emotion report",
      };
    }
  }
}

export { EmotionController };
