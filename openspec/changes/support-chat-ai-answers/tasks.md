# Tasks

## 1. Backend fallback

- [x] 1.1 Add `SUPPORT_CHAT_AI_CONFIG` and `SupportAnswerSource` to `supportChat/types.ts`, the `isAIGenerated` response field and `answerSource`/`aiResponse` question fields; document the variables in `backend/.example.env`
- [x] 1.2 Add `services/SupportAnswerGenerator.ts` (prompt builder, `parseSupportAnswer` validation, OpenAI-compatible call with deadline and cool-down) with tests in `tests/SupportAnswerGenerator.test.ts` covering every rejection rule, provider errors, MiniMax in-200 errors and declines
- [x] 1.3 Add `FAQRetrievalService.rankForContext` (lexical, best first, count and character budgets, never throws), sharing the ranking with `retrieveFAQ`
- [x] 1.4 Call the fallback from `ChatService.handleUserQuestion` before escalating; add `SupportQuestionRepository.setAIAnswer` and record `answerSource: 'faq'` on FAQ matches; bind the generator in `container.ts`; tests in `tests/supportChatAIFallback.test.ts`; verify with `npx vitest run src/modules/supportChat` from `backend/`

## 2. Widget

- [x] 2.1 Render bot replies as Markdown with links opening in a new tab; "AI answer" badge; theme tokens instead of fixed blue/white in `ChatWidget`, `ChatWindow`, `MessageBubble`, `EscalationForm`
- [x] 2.2 Quick-topic buttons that send the four most common FAQ questions; rate AI answers; "Not helpful" shows `EscalationForm` with its own notice; verify by hand in light and dark mode

## 3. Docs

- [x] 3.1 Update the module README and `SUPPORT_CHAT_SETUP.md` with the fallback and its variables
