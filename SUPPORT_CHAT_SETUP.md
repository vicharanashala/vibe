# Support Chat Implementation - Setup & Integration Guide

## Overview

A complete technical support chatbot system has been implemented with:
- **Backend**: Semantic FAQ retrieval with admin fallback workflow
- **Frontend**: Learner chat widget + admin dashboard
- **Database**: MongoDB collections for FAQs and support questions

## What's Been Built

### Backend Module Structure
```
backend/src/modules/supportChat/
├── controllers/
│   ├── ChatController.ts          ✅ Learner endpoints
│   └── AdminController.ts         ✅ Admin endpoints
├── services/
│   ├── ChatService.ts             ✅ Business logic
│   ├── FAQRetrievalService.ts     ✅ Semantic search
│   └── AdminService.ts            ✅ Admin operations
├── repositories/
│   └── providers/mongodb/
│       ├── FAQRepository.ts       ✅ FAQ data access
│       └── SupportQuestionRepository.ts ✅ Questions data access
├── validators/
│   └── SupportChatValidator.ts    ✅ Input validation
├── types.ts                       ✅ All interfaces & constants
├── container.ts                   ✅ DI setup
└── README.md                      ✅ Module documentation
```

### Frontend Components
```
frontend/src/
├── components/support-chat/
│   ├── ChatWidget.tsx             ✅ Floating chat button
│   ├── ChatWindow.tsx             ✅ Main chat interface
│   ├── MessageBubble.tsx          ✅ Message display
│   └── index.ts
├── pages/teacher/support-dashboard/
│   ├── SupportDashboard.tsx       ✅ Admin dashboard
│   ├── StatsCards.tsx             ✅ Dashboard metrics
│   ├── QuestionsTable.tsx         ✅ Questions list
│   ├── ResponsePanel.tsx          ✅ Admin response form
│   └── index.ts
└── hooks/
    ├── useSupportChat.ts          ✅ Learner chat hook
    └── useAdminSupport.ts         ✅ Admin operations hook
```

## Integration Steps

### Steps 1 & 2: Container and controllers — already done

`loadAppModules` walks `backend/src/modules/*` and picks up each module's
`<name>ContainerModules` and `<name>ModuleControllers` exports, both of which
`supportChat/index.ts` provides. Nothing has to be registered by hand.

Controller paths must **not** include `/api`: the app mounts
routing-controllers with `routePrefix: '/api'` already.

### Step 3: Initialize Database Indexes

Before first use, run this setup script or add to your application boot sequence:

```typescript
import { FAQRepository, SupportQuestionRepository, SUPPORT_CHAT_TYPES } from '@/modules/supportChat';

async function initializeSupportChat() {
  const faqRepo = container.get<FAQRepository>(SUPPORT_CHAT_TYPES.FAQRepo);
  const questionRepo = container.get<SupportQuestionRepository>(SUPPORT_CHAT_TYPES.SupportQuestionRepo);

  await faqRepo.createIndex();
  await questionRepo.createIndex();

  console.log('Support Chat indexes created');
}

// Call during app startup
await initializeSupportChat();
```

### Step 4: Configure Environment Variables

Add to your `.env` file:

Every one of these is optional. With none of them set the bot still answers from
the FAQ set by lexical matching; embeddings only sharpen the ranking.

```env
# Minimax embeddings (optional layer)
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_GROUP_ID=your-minimax-group-id
MINIMAX_API_URL=https://api.minimax.io/v1        # Optional, defaults to this
MINIMAX_EMBEDDING_MODEL=embo-01                   # Optional, defaults to this

# Support Chat Configuration
FAQ_CONFIDENCE_THRESHOLD=0.75                     # Bar when embeddings are available
FAQ_LEXICAL_CONFIDENCE_THRESHOLD=0.45             # Bar when they are not
MONGODB_FAQ_COLLECTION=supportFaqs
MONGODB_QUESTIONS_COLLECTION=supportQuestions
```

### Step 5: Seed Initial FAQs

Extract from https://samagama.in/internship/faq#q-13-19 (27 Q&As about ViBe platform).

Create a seed script (`backend/src/scripts/seedSupportChatFAQs.ts`):

```typescript
import { AdminService, SUPPORT_CHAT_TYPES } from '@/modules/supportChat';
import { container } from '@/container';
import { ObjectId } from 'mongodb';

const faqData = [
  {
    question: 'How do I sign up for a course on ViBe?',
    answer: 'Sign up using your registered email on the ViBe platform. Desktop/laptop access only; mobile devices are not supported.',
    category: 'login',
    tags: ['signup', 'enrollment', 'access'],
  },
  // ... add remaining 26 FAQs from samagama.in
];

async function seedFAQs() {
  const adminService = container.get<AdminService>(SUPPORT_CHAT_TYPES.AdminService);
  const systemAdminId = new ObjectId('...'); // Your system admin user ID

  for (const faq of faqData) {
    await adminService.createFAQ(
      {
        ...faq,
        upvotes: 0,
        downvotes: 0,
        usageCount: 0,
        isActive: true,
      },
      systemAdminId
    );
  }

  console.log(`Seeded ${faqData.length} FAQs`);
}

await seedFAQs();
```

Run: `npm run ts-node backend/src/scripts/seedSupportChatFAQs.ts`

### Step 6: Add Chat Widget to Frontend Pages

In your main app layout or any student page (e.g., `StudentLayout.tsx`):

```typescript
import { ChatWidget } from '@/components/support-chat';

export default function StudentLayout() {
  return (
    <div>
      {/* Your page content */}
      <ChatWidget 
        courseId={courseId} 
        courseVersionId={courseVersionId}
        cohortId={cohortId}
      />
    </div>
  );
}
```

### Step 7: Admin Dashboard Route (already wired)

The support queue ships routed — no manual step. It lives at **`/teacher/support`**,
registered as `teacherSupportRoute` in `frontend/src/app/routes/router.tsx` and linked
from the sidebar ("Support Queue") in `frontend/src/components/app-sidebar.tsx`.

Who sees what is decided by the backend, not the route: `GET /admin/support/questions`
scopes results with `resolveSupportQueueCourseIds()` — an admin (`globalRole: 'admin'`)
sees every course, an INSTRUCTOR/MANAGER sees only the courses they staff, and anyone
else gets a 403. The page surfaces that 403 as a permission message rather than an
empty queue.

## Database Collections

### supportFaqs Collection
```javascript
{
  _id: ObjectId,
  question: string,
  answer: string,
  category: 'login' | 'technical' | 'proctoring' | 'features' | 'other',
  tags: string[],
  embedding: number[],              // Claude embedding (768 dimensions)
  upvotes: number,
  downvotes: number,
  usageCount: number,               // Tracks FAQ popularity
  createdBy: ObjectId,              // Admin who created
  createdAt: Date,
  updatedAt: Date,
  isActive: boolean,
  source?: 'admin_response' | 'manual' | 'imported',
  relatedFaqIds?: ObjectId[],
}

// Indexes
db.supportFaqs.createIndex({ category: 1, isActive: 1 })
db.supportFaqs.createIndex({ tags: 1 })
db.supportFaqs.createIndex({ createdAt: -1 })
db.supportFaqs.createIndex({ question: 'text', answer: 'text' })
```

### supportQuestions Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  courseId?: ObjectId,
  courseVersionId?: ObjectId,
  cohortId?: ObjectId,
  question: string,
  context?: { page: string, itemId: ObjectId, module: string },
  status: 'PENDING' | 'ANSWERED' | 'RESOLVED' | 'ESCALATED',
  matchedFaqId?: ObjectId,
  confidenceScore?: number,
  adminResponse?: {
    respondedBy: ObjectId,
    response: string,
    responseAt: Date,
  },
  faqCreatedFromThis?: ObjectId,    // If admin created FAQ from response
  learnersSeenResponse: boolean,
  resolutionRating?: 'helpful' | 'not_helpful',
  createdAt: Date,
  updatedAt: Date,
}

// Indexes
db.supportQuestions.createIndex({ userId: 1, createdAt: -1 })
db.supportQuestions.createIndex({ status: 1, createdAt: -1 })
db.supportQuestions.createIndex({ courseId: 1, status: 1 })
db.supportQuestions.createIndex({ createdAt: -1 })
```

## API Endpoints (Ready to Use)

### Learner Endpoints
- `POST /api/support/chat/message` - Send question
- `GET /api/support/chat/history` - Get chat history
- `GET /api/support/chat/:questionId` - Get single question
- `PATCH /api/support/chat/:questionId/rate` - Rate response

### Admin Endpoints
- `GET /api/admin/support/dashboard` - Dashboard stats & recent questions
- `GET /api/admin/support/questions` - List all questions
- `POST /api/admin/support/questions/:questionId/respond` - Send response
- `PUT /api/admin/support/questions/:questionId/resolve` - Mark resolved
- `GET /api/admin/support/faqs` - List FAQs
- `POST /api/admin/support/faqs` - Create FAQ
- `PUT /api/admin/support/faqs/:faqId` - Update FAQ
- `DELETE /api/admin/support/faqs/:faqId` - Delete FAQ

## Testing the Implementation

### 1. Test Learner Chat
```bash
curl -X POST http://localhost:3001/api/support/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "How do I sign up for a course?",
    "context": { "page": "/student/dashboard" }
  }'
```

Expected response:
```json
{
  "response": "Sign up using your registered email on the ViBe platform...",
  "confidence": 0.85,
  "faqId": "6...",
  "isFromFAQ": true,
  "isEscalated": false,
  "questionId": "6...",
  "source": "From our FAQ (Added on 8/7/2026)"
}
```

### 2. Test Low-Confidence Question (Escalation)
```bash
curl -X POST http://localhost:3001/api/support/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "What is the meaning of life?"
  }'
```

Expected: Question escalated to admin queue (confidence < 0.75)

### 3. Test Admin Dashboard
Visit: `http://localhost:3000/teacher/support`
(Requires admin role)

## What's Left to Do (Phase 2+)

### Immediate (Before First Deploy)
- [ ] Seed 27 FAQs from samagama.in/internship/faq#q-13-19
- [ ] Test end-to-end: learner question → admin response → learner notification
- [ ] Add notification integration (already in ViBe, link it)
- [ ] Add rate limiting to chat endpoints
- [ ] Test Anthropic API embedding generation

### Short Term (2-3 weeks)
- [ ] Admin FAQ bulk management UI
- [ ] Learner notification when admin responds
- [ ] Analytics dashboard (top questions, response times)
- [ ] Search functionality in FAQ list
- [ ] Multi-language support for FAQ responses

### Medium Term (Phase 2)
- [ ] Proactive FAQ suggestions based on learner context
- [ ] Email notifications for admins
- [ ] AI-powered FAQ generation suggestions
- [ ] Sentiment analysis for frustrated learners
- [ ] Integration with learner performance data

## Troubleshooting

### Embeddings not generating
- Verify `MINIMAX_API_KEY` is set and valid. Minimax answers a bad key with
  HTTP 200 and `base_resp.status_code: 2049`, so a green status code proves
  nothing — the service logs the decoded error
- After a failure the service stops calling the provider for
  `SUPPORT_CHAT_EMBEDDING_COOLDOWN_MS` (default 10 min) and matches lexically
- Verify `MINIMAX_API_URL` is correct (defaults to `https://api.minimax.io/v1`)
- Embeddings are generated lazily for the best-matching FAQs and stored on the
  FAQ document, a few per chat turn

### Every question escalates to admin
- Confirm the FAQ set is seeded and the documents have `isActive: true`
- Lower `FAQ_LEXICAL_CONFIDENCE_THRESHOLD` (default 0.45) to inspect near-misses
- With embeddings configured the bar is `FAQ_CONFIDENCE_THRESHOLD` (default 0.75)

### Admin dashboard not loading questions
- Verify admin has correct role (`admin` or `staff`)
- Check MongoDB `supportQuestions` collection exists
- Verify MongoDB connection and collection permissions

### Chat widget not appearing on page
- Confirm `ChatWidget` is imported and rendered
- Check localStorage for auth token
- Verify frontend API URL matches backend

## Performance Considerations

1. **Embedding Generation**: First FAQ creation takes ~500ms per embedding. Cached thereafter.
2. **FAQ Retrieval**: Linear search through all active FAQs (fast for <1000 FAQs). Vector DB recommended for scale.
3. **Admin Queries**: Indexed on status + courseId for fast filtering
4. **Rate Limiting**: Recommended: 5 q/min per learner, unlimited for admins

## Security

- All learner endpoints require authentication
- Admins can only access FAQs and questions in their courses
- Learners only see their own chat history
- No sensitive data stored in FAQ content
- Embeddings are server-side generated (no client exposure)

## Support & Questions

Refer to `backend/src/modules/supportChat/README.md` for technical details on services and retrieval algorithm.
