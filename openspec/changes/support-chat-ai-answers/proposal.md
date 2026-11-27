# Proposal

## Why

The learner Support Assistant answers only when a question shares enough words with an FAQ. Learners often describe the same problem in other words ("webcam not detected" for the camera FAQ, "my camera is not working") or in Hinglish ("video baar baar ruk raha hai"). Those questions get escalated to the support team even though the FAQ bank already has the answer, which slows learners down and fills the admin queue with questions the bot could have handled.

The widget also hides the structure of FAQ answers: numbered steps and bullets are written on separate lines but shown as one run-on paragraph, links are plain text, and the widget's bright blue-and-white styling ignores ViBe's theme and dark mode.

## What Changes

- **AI fallback (backend)**: when no FAQ clears the confidence bar, a chat model is given the closest FAQs and either answers **only from them** or declines. Only a decline, or any failure, escalates. An answer is shown only if it cites at least one FAQ it was given and every link in it appears in a cited FAQ. Model answers are recorded on the question (`answerSource: 'ai'`, `aiResponse`) for auditing.
- **Provider**: any OpenAI-compatible chat-completions endpoint. Defaults to the MiniMax key, endpoint and model that screening and Smart Bloom already use; `SUPPORT_CHAT_LLM_URL`, `_API_KEY` and `_MODEL` select another provider. `SUPPORT_CHAT_AI_ENABLED=false` turns it off. With no key the bot behaves exactly as today.
- **Widget (frontend)**: answers render as Markdown (lists, clickable links); AI answers carry an "AI answer" badge and can be rated; "Not helpful" on any answer opens the existing issue-report form; quick-topic buttons for the four most common issues; colours from the theme tokens so it follows light and dark mode.

Out of scope: chat history across reloads, streaming replies, using course or page context in answers, letting the model write or edit FAQs, and showing AI answers in the admin dashboard.

## Capabilities

### New Capabilities

- `backend/support-chat`: how the learner Support Assistant answers a question, when it escalates, and what it records.
- `frontend/support-chat`: how the chat widget shows answers and collects feedback.

### Modified Capabilities

<!-- None: no existing spec covers the support chat. -->

## Impact

- **Backend**: new `SupportAnswerGenerator` service; `FAQRetrievalService.rankForContext`; `ChatService` calls the fallback before escalating; `SupportQuestionRepository.setAIAnswer`; config and env vars in `types.ts` and `.example.env`. No new dependencies, no API shape changes beyond the optional `isAIGenerated` response field.
- **Frontend** (`frontend/`): support-chat components and types only. Uses `react-markdown` and `remark-gfm`, already dependencies.
- **Cost and latency**: one model call per question that misses the FAQs (not per question), bounded by a 20 s deadline and a 2-minute pause after a provider failure.
- **Data**: two optional fields on `supportQuestions` documents; no migration.
