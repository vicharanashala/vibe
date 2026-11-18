# Spec Delta

## Purpose

How the learner Support Assistant answers a question, when it hands the question to the support team, and what it records about each answer.

## ADDED Requirements

### Requirement: Confident FAQ matches are answered verbatim
When an FAQ matches a learner's question with enough confidence, the assistant SHALL reply with that FAQ's answer unchanged and SHALL NOT call the AI model.

#### Scenario: Question restates an FAQ
- **WHEN** a learner asks "How do I log in to ViBe?" and an FAQ with that question exists
- **THEN** the reply is that FAQ's answer, marked as from the FAQ, and no model call is made

### Requirement: AI answer from FAQs when no FAQ matches
When no FAQ matches confidently and the AI fallback is configured, the assistant SHALL ask the model to answer using only the closest FAQs, and SHALL show the model's answer, marked as an AI answer that names the FAQ it is based on, instead of escalating.

#### Scenario: Different words for an FAQ topic
- **WHEN** a learner asks "webcam not detected", no FAQ matches confidently, and the model answers from the camera FAQ
- **THEN** the learner sees that answer with an "AI answer" label, the question is stored as ANSWERED with `answerSource: 'ai'` and the reply, and it is not escalated

### Requirement: Only grounded AI answers are shown
The assistant SHALL show a model answer only if the model says it can answer, the answer is non-empty and at most 2,500 characters, it cites at least one FAQ it was given, every cited FAQ exists, and every link in the answer appears in a cited FAQ. Otherwise it SHALL escalate.

#### Scenario: Model declines
- **WHEN** the model replies that the FAQs don't answer the question
- **THEN** the question is escalated exactly as when no fallback exists

#### Scenario: Invented link
- **WHEN** the model's answer contains a URL that none of its cited FAQs contain
- **THEN** the answer is discarded and the question is escalated

### Requirement: Failures escalate
Any model failure SHALL escalate the question and never fail the chat request; after a provider failure the assistant SHALL stop calling the model for a cool-down period (2 minutes by default).

#### Scenario: Provider down
- **WHEN** the model endpoint returns HTTP 503 or times out
- **THEN** the learner gets the escalation reply, and questions in the next 2 minutes escalate without calling the model

#### Scenario: Not configured
- **WHEN** no API key is configured, or `SUPPORT_CHAT_AI_ENABLED` is `false`
- **THEN** the assistant behaves as before: FAQ answer or escalation, with no model call
