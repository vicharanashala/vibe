/**
 * Frontend mirror of backend/src/modules/supportChat/types.ts.
 *
 * Ids are `string` here rather than `ObjectId` — they arrive serialized over
 * JSON. Keep the enum values byte-identical to the backend, since they cross
 * the wire as-is.
 */

export enum FAQCategory {
  LOGIN = 'login',
  TECHNICAL = 'technical',
  PROCTORING = 'proctoring',
  FEATURES = 'features',
  OTHER = 'other',
}

export enum SupportQuestionStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export enum ResolutionRating {
  HELPFUL = 'helpful',
  NOT_HELPFUL = 'not_helpful',
}

export enum FAQSource {
  ADMIN_RESPONSE = 'admin_response',
  MANUAL = 'manual',
  IMPORTED = 'imported',
}

export interface IFAQ {
  _id?: string;
  question: string;
  answer: string;
  category: FAQCategory;
  tags: string[];
  upvotes: number;
  downvotes: number;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  source?: FAQSource;
  relatedFaqIds?: string[];
}

export interface ISupportQuestionContext {
  page?: string;
  itemId?: string;
  module?: string;
}

export interface ISupportEscalation {
  category: FAQCategory;
  details: string;
  contactEmail?: string;
  submittedAt: string;
}

export interface ISupportQuestion {
  _id?: string;
  userId: string;
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  question: string;
  context?: ISupportQuestionContext;
  status: SupportQuestionStatus;
  matchedFaqId?: string;
  confidenceScore?: number;
  adminResponse?: {
    respondedBy: string;
    response: string;
    responseAt: string;
  };
  escalation?: ISupportEscalation;
  faqCreatedFromThis?: string;
  learnersSeenResponse: boolean;
  resolutionRating?: ResolutionRating;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRequest {
  question: string;
  context?: ISupportQuestionContext;
}

export interface ChatMessageResponse {
  response: string;
  confidence: number;
  faqId?: string;
  isFromFAQ: boolean;
  isEscalated: boolean;
  questionId: string;
  source?: string;
}

export interface AdminResponseRequest {
  response: string;
  createFaq?: boolean;
  faqCategory?: FAQCategory;
  faqTags?: string[];
}

export interface EscalateQuestionRequest {
  category: FAQCategory;
  details: string;
  contactEmail?: string;
}

/** Shape returned by GET /admin/support/dashboard. */
export interface SupportDashboardStats {
  totalQuestions: number;
  pending: number;
  answered: number;
  resolved: number;
  escalated: number;
  /** Minutes between a question being asked and an admin answering it. */
  avgResolutionTime: number;
  satisfactionRate: number;
}

export interface SupportDashboardResponse {
  stats: SupportDashboardStats;
  recentPending: ISupportQuestion[];
}

export interface SupportQuestionsResponse {
  questions: ISupportQuestion[];
  total: number;
}
