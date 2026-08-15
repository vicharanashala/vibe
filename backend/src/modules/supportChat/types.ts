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

/**
 * Filled in when the learner follows up an unanswered question with the
 * technical-issue form. The question row already exists at that point — this
 * only adds the detail the bot could not extract from a one-line question.
 */
export interface ISupportEscalation {
  category: FAQCategory;
  details: string;
  contactEmail?: string;
  submittedAt: Date;
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
  escalation?: ISupportEscalation;
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

export interface EscalateQuestionRequest {
  category: FAQCategory;
  details: string;
  contactEmail?: string;
}

/**
 * The statuses an admin still has to act on. A question the bot answered from
 * the FAQ bank is ANSWERED and needs nothing; PENDING only survives when a
 * chat turn failed midway, so it stays in the queue alongside ESCALATED.
 */
export const OPEN_SUPPORT_QUESTION_STATUSES = [
  SupportQuestionStatus.ESCALATED,
  SupportQuestionStatus.PENDING,
] as const;

export interface AdminResponseRequest {
  response: string;
  createFaq?: boolean;
  faqCategory?: FAQCategory;
  faqTags?: string[];
}

export const FAQ_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.FAQ_CONFIDENCE_THRESHOLD || '0.75'
);

/**
 * Lexical matching is a weaker signal than embeddings, so it gets its own,
 * lower bar. Retrieval falls back to it whenever the embedding provider is
 * unconfigured or failing, which is the only way the bot answers at all when
 * no FAQ has an embedding yet.
 */
export const FAQ_LEXICAL_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.FAQ_LEXICAL_CONFIDENCE_THRESHOLD || '0.45'
);

export const SUPPORT_CHAT_CONFIG = {
  confidenceThreshold: FAQ_CONFIDENCE_THRESHOLD,
  lexicalConfidenceThreshold: FAQ_LEXICAL_CONFIDENCE_THRESHOLD,
  maxSearchResults: 5,
  embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
  minimaxApiUrl: process.env.MINIMAX_API_URL || 'https://api.minimax.io/v1',
  minimaxGroupId: process.env.MINIMAX_GROUP_ID,
  /** Hard deadline per embedding call — a slow provider must not hang a chat turn. */
  embeddingTimeoutMs: Number(process.env.SUPPORT_CHAT_EMBEDDING_TIMEOUT_MS || '8000'),
  /** FAQs whose embedding is generated and stored per chat turn, best-matching first. */
  maxEmbeddingBackfillPerRequest: Number(
    process.env.SUPPORT_CHAT_EMBEDDING_BACKFILL_LIMIT || '5'
  ),
  /** How long to stop calling the embedding provider after it fails. */
  embeddingCooldownMs: Number(
    process.env.SUPPORT_CHAT_EMBEDDING_COOLDOWN_MS || String(10 * 60 * 1000)
  ),
  collectionsNames: {
    faq: process.env.MONGODB_FAQ_COLLECTION || 'supportFaqs',
    questions: process.env.MONGODB_QUESTIONS_COLLECTION || 'supportQuestions',
    analytics: 'supportAnalytics',
  },
};
