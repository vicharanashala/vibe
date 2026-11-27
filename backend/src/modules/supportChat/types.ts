import { ObjectId } from 'mongodb';

export const SUPPORT_CHAT_TYPES = {
  FAQRepository: Symbol.for('FAQRepository'),
  FAQRepo: Symbol.for('FAQRepository'),
  SupportQuestionRepository: Symbol.for('SupportQuestionRepository'),
  SupportQuestionRepo: Symbol.for('SupportQuestionRepository'),
  FAQRetrievalService: Symbol.for('FAQRetrievalService'),
  ChatService: Symbol.for('ChatService'),
  AdminService: Symbol.for('AdminService'),
  SupportAnswerGenerator: Symbol.for('SupportAnswerGenerator'),
};

/**
 * Who produced the reply a learner saw: an FAQ answer shown verbatim, or a
 * model-written answer grounded in FAQs. Unset on rows written before the AI
 * fallback existed, which were all FAQ answers or escalations.
 */
export type SupportAnswerSource = 'faq' | 'ai';

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
  answerSource?: SupportAnswerSource;
  /**
   * The model-written reply, kept so an admin can audit what the learner was
   * told. FAQ replies are not copied here: matchedFaqId already points at them.
   */
  aiResponse?: string;
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
  /** True when the reply was written by the model from FAQ content. */
  isAIGenerated?: boolean;
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

/**
 * The AI fallback: when no FAQ clears the confidence bar, a chat model is
 * given the closest FAQs and either answers from them or declines. Only a
 * decline escalates to the support team.
 *
 * Any OpenAI-compatible chat-completions endpoint works. By default it reuses
 * the MiniMax key, endpoint and model that screening and Smart Bloom already
 * read, so a server that has them needs no new secret. Setting
 * SUPPORT_CHAT_LLM_URL points it at another provider (Groq, Gemini's
 * OpenAI-compatible endpoint, ...); then SUPPORT_CHAT_LLM_API_KEY and
 * SUPPORT_CHAT_LLM_MODEL are required, and the MiniMax key is never sent to
 * that other host.
 */
const supportChatLlmUrl = process.env.SUPPORT_CHAT_LLM_URL;

export const SUPPORT_CHAT_AI_CONFIG = {
  /** Master switch. The fallback also stays off while no key or model is set. */
  enabled: (process.env.SUPPORT_CHAT_AI_ENABLED || 'true') !== 'false',
  apiKey:
    process.env.SUPPORT_CHAT_LLM_API_KEY ||
    (supportChatLlmUrl ? undefined : process.env.MINIMAX_API_KEY),
  url:
    supportChatLlmUrl ||
    process.env.MINIMAX_URL ||
    (process.env.MINIMAX_API_URL
      ? `${process.env.MINIMAX_API_URL.replace(/\/+$/, '')}/chat/completions`
      : 'https://api.minimax.io/v1/chat/completions'),
  model:
    process.env.SUPPORT_CHAT_LLM_MODEL ||
    (supportChatLlmUrl ? undefined : process.env.MINIMAX_MODEL || 'MiniMax-M3'),
  /** A learner is waiting on this call, so it gets a short deadline. */
  timeoutMs: Number(process.env.SUPPORT_CHAT_LLM_TIMEOUT_MS || '20000'),
  /** How long to stop calling the model after it fails, so turns don't each wait on a dead provider. */
  cooldownMs: Number(
    process.env.SUPPORT_CHAT_LLM_COOLDOWN_MS || String(2 * 60 * 1000),
  ),
  /** Upper bounds on the FAQ text sent with each question, best matches first. */
  maxContextFaqs: Number(process.env.SUPPORT_CHAT_LLM_MAX_FAQS || '25'),
  maxContextChars: Number(
    process.env.SUPPORT_CHAT_LLM_MAX_CONTEXT_CHARS || '16000',
  ),
};

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
  ai: SUPPORT_CHAT_AI_CONFIG,
  collectionsNames: {
    faq: process.env.MONGODB_FAQ_COLLECTION || 'supportFaqs',
    questions: process.env.MONGODB_QUESTIONS_COLLECTION || 'supportQuestions',
    analytics: 'supportAnalytics',
  },
};
