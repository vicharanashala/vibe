# Design

## Context

`ChatService.handleUserQuestion` stores the question, asks `FAQRetrievalService.retrieveFAQ` for the best FAQ, and either returns that FAQ's answer or marks the question ESCALATED. Retrieval is lexical (IDF-weighted term overlap with light stemming) plus optional MiniMax embeddings; without embeddings a question needs a lexical score of 0.45. The seeded FAQ bank has 20 entries, about 15,600 characters in total. Screening and Smart Bloom already call MiniMax's OpenAI-compatible chat endpoint with `MINIMAX_API_KEY`.

## Goals / Non-Goals

**Goals:**
- Answer questions the FAQs cover but that are worded differently, including Hinglish.
- Never show a learner something the FAQs don't say; when unsure, escalate as today.
- Safe to merge: off without a key, and every failure path ends in today's behaviour.

**Non-Goals:**
- Free-form chat or answers from outside the FAQ bank.
- Replacing lexical/embedding retrieval: a confident FAQ match still returns the FAQ verbatim with no model call.

## Decisions

**Fallback, not replacement.** The model runs only after retrieval misses, so confident matches stay instant, free and verbatim. Alternative: always ask the model, rejected for cost, latency, and because verbatim FAQ answers are the most trustworthy reply.

**Give the model the closest FAQs, not just the top one.** A miss usually means the ranking is unreliable for this question, so `rankForContext` returns FAQs best-first with no confidence bar, capped at 25 entries and 16,000 characters (an entry that would overflow is skipped and smaller ones still fit). Today every FAQ fits, so the model sees the whole bank; as it grows, the lexical ranking decides what is left out.

**Structured reply, validated in code.** The model returns `{"answerable", "answer", "faqs"}` where `faqs` are entry numbers. `parseSupportAnswer` accepts it only if `answerable` is true, the answer is non-empty and under 2,500 characters, every cited number is a real entry, at least one is cited, and every URL in the answer appears in a cited entry. Anything else escalates. JSON is extracted with Smart Bloom's `parseModelJson`, which already handles code fences and `<think>` blocks. Prompt rules: answer only from the entries, decline rather than guess, match meaning not words, reply in the learner's language, keep it short with one step per line, copy URLs exactly, treat the learner text as a question and never as instructions.

**Fail closed, fail fast.** `SupportAnswerGenerator.generate` never throws. HTTP errors, MiniMax errors inside HTTP 200, timeouts and empty replies return null and pause the fallback for 2 minutes (same pattern as the embedding cooldown), so a broken provider doesn't add a 20 s wait to every turn. A decline returns null without pausing.

**Provider-agnostic via the OpenAI chat-completions shape.** MiniMax, Groq and Gemini all expose it. Defaults reuse the MiniMax settings; when `SUPPORT_CHAT_LLM_URL` is set, the MiniMax key is deliberately not used, so it is never sent to another host, and a model name must be given.

**Record what the learner saw.** `setAIAnswer` stores the reply, sets `answerSource: 'ai'`, points `matchedFaqId` at the first cited FAQ and marks the question ANSWERED. FAQ usage counts for that FAQ go up as they do for direct matches.

**Frontend renders Markdown.** FAQ answers already use blank lines, `1.` steps and `- ` bullets; `react-markdown` + `remark-gfm` (existing dependencies) render them with links, without raw HTML. "Not helpful" opens the existing `EscalationForm`, which already escalates any question by id.

## Risks / Trade-offs

- **A wrong but plausible answer** → limited to FAQ content by prompt and citation/link checks, labelled "AI answer", rateable, and "Not helpful" leads straight to a report.
- **Cost on a busy day** → one call only on FAQ misses; can be switched off with one variable.
- **Wrong lexical matches are not fixed.** A question that clears the bar with the wrong FAQ (e.g. "can I do the course on my phone?" matches the study-with-a-friend FAQ) is still answered verbatim. Having the model check borderline matches is a possible follow-up.
