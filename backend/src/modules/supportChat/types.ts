import { ObjectId } from 'mongodb';

export const SUPPORT_CHAT_TYPES = {
  FAQRepository: Symbol.for('FAQRepository'),
  FAQRepo: Symbol.for('FAQRepository'),
  SupportQuestionRepository: Symbol.for('SupportQuestionRepository'),
  SupportQuestionRepo: Symbol.for('SupportQuestionRepository'),
  FAQRetrievalService: Symbol.for('FAQRetrievalService'),
  ChatService: Symbol.for('ChatService'),
  AdminService: Symbol.for('AdminService'),
};

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
  _id?: ObjectId;
  question: string;
  answer: string;
  category: FAQCategory;
  tags: string[];
  embedding?: number[];
  upvotes: number;
  downvotes: number;
  usageCount: number;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  source?: FAQSource;
  relatedFaqIds?: ObjectId[];
}

export interface ISupportQuestion {
  _id?: ObjectId;
  userId: ObjectId;
  courseId?: ObjectId;
  courseVersionId?: ObjectId;
  cohortId?: ObjectId;
  question: string;
  context?: {
    page?: string;
    itemId?: ObjectId;
    module?: string;
  };
  status: SupportQuestionStatus;
  matchedFaqId?: ObjectId;
  confidenceScore?: number;
  adminResponse?: {
    respondedBy: ObjectId;
    response: string;
    responseAt: Date;
  };
  faqCreatedFromThis?: ObjectId;
  learnersSeenResponse: boolean;
  resolutionRating?: ResolutionRating;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportAnalytics {
  _id?: ObjectId;
  date: string;
  courseId?: ObjectId;
  totalQuestions: number;
  resolvedByFaq: number;
  escalatedToAdmin: number;
  avgResolutionTime: number;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  adminResponseTime: number;
  learnerSatisfactionRate: number;
  createdAt: Date;
}

export interface FAQRetrievalResult {
  faq: IFAQ;
  similarity: number;
  recency: number;
  popularity: number;
  score: number;
}

export interface ChatMessageRequest {
  question: string;
  context?: {
    page?: string;
    itemId?: ObjectId;
    module?: string;
  };
}

export interface ChatMessageResponse {
  response: string;
  confidence: number;
  faqId?: ObjectId;
  isFromFAQ: boolean;
  isEscalated: boolean;
  questionId: ObjectId;
  source?: string;
}

export interface AdminResponseRequest {
  response: string;
  createFaq?: boolean;
  faqCategory?: FAQCategory;
  faqTags?: string[];
}

export const FAQ_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.FAQ_CONFIDENCE_THRESHOLD || '0.75'
);

export const SUPPORT_CHAT_CONFIG = {
  confidenceThreshold: FAQ_CONFIDENCE_THRESHOLD,
  maxSearchResults: 5,
  embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  minimaxApiUrl: process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1',
  collectionsNames: {
    faq: process.env.MONGODB_FAQ_COLLECTION || 'supportFaqs',
    questions: process.env.MONGODB_QUESTIONS_COLLECTION || 'supportQuestions',
    analytics: 'supportAnalytics',
  },
};
