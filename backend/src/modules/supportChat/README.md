# Support Chat Module

A comprehensive technical support chatbot module for the ViBe platform that helps learners resolve issues using an FAQ knowledge base, with automatic escalation to admins for unanswered questions.

## Architecture

```
Learner Chat Widget
    ↓
ChatController (API endpoints)
    ↓
ChatService (Business logic)
    ↓
FAQRetrievalService (Semantic search + scoring)
    ↓
FAQRepository ← MongoDB (supportFaqs collection)
SupportQuestionRepository ← MongoDB (supportQuestions collection)

Admin Dashboard
    ↓
AdminController (API endpoints)
    ↓
AdminService (Admin operations)
    ↓
Question Queue → Admin Responses → Optional FAQ Creation
```

## File Structure

```
supportChat/
├── controllers/
│   ├── ChatController.ts          # Learner chat endpoints
│   ├── AdminController.ts         # Admin dashboard endpoints
│   └── index.ts
├── services/
│   ├── ChatService.ts             # Main chat business logic
│   ├── FAQRetrievalService.ts     # Semantic FAQ search & scoring
│   ├── AdminService.ts            # Admin operations
│   └── index.ts
├── repositories/
│   └── providers/
│       └── mongodb/
│           ├── FAQRepository.ts
│           ├── SupportQuestionRepository.ts
│           └── index.ts
├── validators/
│   ├── SupportChatValidator.ts
│   └── index.ts
├── classes/
│   └── transformers/
│       └── index.ts
├── types.ts                       # All TypeScript interfaces & constants
├── container.ts                   # Inversify DI setup
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Key Features

### 1. FAQ Retrieval
- Lexical (IDF-weighted term coverage) matching that works with no external service
- Optional MiniMax embeddings layered on top when a key is configured, generated
  lazily per FAQ and stored, so the provider is never on the critical path
- Confidence-based filtering, with a separate lower bar for lexical-only matching
- No hallucinations - returns only FAQ content

### 2. Admin Fallback Workflow
- Questions below confidence threshold go to admin queue
- Admins review and respond to learners
- Option to add responses as new FAQs
- Auto-generates embeddings for new FAQs
- Learner notifications when admin responds

### 3. Data Persistence
- **supportFaqs**: Stores FAQ questions, answers, categories, embeddings, usage stats
- **supportQuestions**: Tracks learner questions, admin responses, ratings
- Indexed for optimal retrieval performance

## API Endpoints

### Learner Endpoints

**Send Chat Message**
```
POST /api/support/chat/message
Query: ?courseId=xxx&courseVersionId=xxx&cohortId=xxx
Body: { question: string, context?: {...} }
Response: { response, confidence, faqId?, isFromFAQ, isEscalated, questionId, source? }
```

**Get Chat History**
```
GET /api/support/chat/history
Query: ?limit=50
Response: { questions: ISupportQuestion[], total: number }
```

**Get Single Question**
```
GET /api/support/chat/:questionId
Response: ISupportQuestion
```

**Rate Resolution**
```
PATCH /api/support/chat/:questionId/rate
Body: { rating: 'helpful' | 'not_helpful' }
Response: ISupportQuestion
```

**Report a Technical Issue** (the escalation form the widget shows when the
assistant has no answer; resubmitting replaces the earlier report)
```
POST /api/support/chat/:questionId/escalate
Body: { category: FAQCategory, details: string, contactEmail?: string }
Response: ISupportQuestion (status ESCALATED, with `escalation` populated)
```

### Admin Endpoints

**Get Dashboard Stats**
```
GET /api/admin/support/dashboard
Query: ?courseId=xxx&startDate=xxx&endDate=xxx
Response: { stats: {...}, recentPending: ISupportQuestion[] }
```

**Get the Queue**
```
GET /api/admin/support/questions
Query: ?status=ESCALATED&page=1&limit=50&courseId=xxx
Response: { questions: ISupportQuestion[], total: number }
```
Omit `status` for the open queue — ESCALATED plus anything left PENDING by an
interrupted chat turn. Results are scoped to the caller: admins see every
course, INSTRUCTOR/MANAGER see the courses they staff, everyone else gets 403.

**Respond to Question**
```
POST /api/admin/support/questions/:questionId/respond
Body: { response: string, createFaq?: boolean, faqCategory?: string, faqTags?: string[] }
Response: ISupportQuestion (with admin response)
```

**Mark Question Resolved**
```
PUT /api/admin/support/questions/:questionId/resolve
Response: ISupportQuestion
```

**Manage FAQs**
```
GET    /api/admin/support/faqs                  # List all FAQs
POST   /api/admin/support/faqs                  # Create new FAQ
PUT    /api/admin/support/faqs/:faqId           # Update FAQ
DELETE /api/admin/support/faqs/:faqId           # Delete FAQ
```

## Types & Constants

All types are defined in `types.ts`:

- `IFAQ`: FAQ document structure with embeddings
- `ISupportQuestion`: Learner question with admin response
- `ISupportAnalytics`: Daily metrics (optional, Phase 2)
- `ChatMessageRequest/Response`: API request/response shapes
- `AdminResponseRequest`: Admin response payload
- Enums: `FAQCategory`, `SupportQuestionStatus`, `ResolutionRating`, `FAQSource`

## Environment Configuration

All of these are optional — with none of them set the bot still answers from the
FAQ set using lexical matching.

```env
MINIMAX_API_KEY=your-minimax-api-key         # enables the embedding layer
MINIMAX_GROUP_ID=your-minimax-group-id       # MiniMax sends this as a query param
MINIMAX_API_URL=https://api.minimax.io/v1    # embedding endpoint host
MINIMAX_EMBEDDING_MODEL=embo-01
FAQ_CONFIDENCE_THRESHOLD=0.75                # bar when embeddings are available
FAQ_LEXICAL_CONFIDENCE_THRESHOLD=0.45        # bar when they are not
MONGODB_FAQ_COLLECTION=supportFaqs
MONGODB_QUESTIONS_COLLECTION=supportQuestions
```

## Setup & Integration

### 1. Add to Container
In your main application container, import and register the module:

```typescript
import { supportChatContainerModule } from '@/modules/supportChat';

// In your container setup:
container.load(supportChatContainerModule);
```

### 2. Register Controllers
If using routing-controllers, the controllers are auto-registered via decorators:

```typescript
import { ChatController, AdminController } from '@/modules/supportChat';

useContainer(container);
useControllers([ChatController, AdminController]);
```

### 3. Initialize MongoDB Indexes
Before first use, ensure indexes are created:

```typescript
const faqRepo = container.get<FAQRepository>(SUPPORT_CHAT_TYPES.FAQRepo);
const questionRepo = container.get<SupportQuestionRepository>(SUPPORT_CHAT_TYPES.SupportQuestionRepo);

await faqRepo.createIndex();
await questionRepo.createIndex();
```

### 4. Seed Initial FAQs
Load the 27 Q&As from samagama.in/internship/faq#q-13-19:

```typescript
const adminService = container.get<AdminService>(SUPPORT_CHAT_TYPES.AdminService);
const adminUserId = new ObjectId(/* system user */);

for (const faqData of initialFAQs) {
  await adminService.createFAQ(faqData, adminUserId);
}
```

## Retrieval Algorithm

Every question is scored lexically first, because that path has no external
dependency and works on FAQs that have never been embedded:

**Lexical score**: the share of the question's information — each term weighted
by its inverse document frequency across the FAQ set — that the FAQ covers,
discounted by where the term was found (its own question 1.0, tags 0.8,
answer 0.5). Terms no FAQ contains still count against coverage, so a question
about something unknown cannot score a confident match.

If an embedding provider is reachable, the question is embedded, the top lexical
candidates have their own embeddings generated and stored (bounded per request),
and the final score becomes `0.7 × cosine similarity + 0.3 × lexical`. Popularity
adds a tiebreak of at most 0.01. Recency is reported but no longer penalises.

The bar depends on which signal was available: `FAQ_CONFIDENCE_THRESHOLD` (0.75)
with embeddings, `FAQ_LEXICAL_CONFIDENCE_THRESHOLD` (0.45) without. Anything
below it, or any retrieval failure, escalates to the admin queue rather than
erroring the chat turn.

## Security & Access Control

- **Learner endpoints**: Require `@Authorized('user')` - users see only their own questions
- **Admin endpoints**: Require `@Authorized('admin', 'staff')` - admins can view all questions in their courses
- **Data privacy**: No continuous video recording, no sensitive data in FAQ
- **Rate limiting**: Apply rate limits to prevent chat spam (5 q/min for learners)

## Testing Strategy

### Unit Tests
- FAQ retrieval scoring algorithm
- Confidence threshold edge cases
- Embedding generation

### Integration Tests
- Learner question → auto-response
- Learner question → admin queue
- Admin response → learner notification
- Admin creates FAQ → appears in retrieval pool

### E2E Tests
- Full user journey: open chat → ask question → get response
- Admin journey: review queue → respond → learner notified

## Monitoring & Analytics (Phase 2)

Track metrics from `supportAnalytics`:
- Total questions per day
- % resolved by FAQ vs. escalated to admin
- Average admin response time
- Learner satisfaction rate (helpful/not_helpful)
- Top question categories

## Future Enhancements

1. **Multi-language support**: Translate FAQs and responses
2. **Proactive assistance**: Suggest FAQs based on learner context
3. **AI-powered suggestions**: Auto-generate FAQ candidates from common unanswered questions
4. **Sentiment analysis**: Flag frustrated learners for priority support
5. **Integration with performance data**: Recommend resources based on learner struggles
6. **Mobile support**: Extend chat widget to mobile apps
7. **Conversation analytics**: Track conversation flow and improvement opportunities

## Dependencies

- `inversify`: Dependency injection
- `routing-controllers`: Express decorators
- `mongodb`: Database access
- `class-validator`: Input validation

Embeddings are fetched over `fetch` from MiniMax; no vendor SDK is required.

## Support & Debugging

**Check logs**: Look for "ChatService", "FAQRetrievalService", "AdminService" logger outputs
**Test retrieval**: Use ChatService.handleUserQuestion() with test questions
**Everything escalates**: check the FAQ set is non-empty and `isActive`, then
lower `FAQ_LEXICAL_CONFIDENCE_THRESHOLD` to see the near-misses
**Embeddings look inert**: the service logs once and stops calling the provider
for `SUPPORT_CHAT_EMBEDDING_COOLDOWN_MS` after a failure — MiniMax reports a bad
key as HTTP 200 with a non-zero `base_resp.status_code`
**Monitor queue**: Admin dashboard shows pending questions count
