# Concept Map Navigator — Design Decisions (ADR Log)

Feature: **Concept Map Navigator** — an LLM-generated, hierarchical prerequisite map of the concepts
in an uploaded lecture, shown to students alongside the section's videos as both an advance
organizer (what am I about to learn, in what order) and a navigator (click a concept to jump to
where it is taught).

Status: design locked 2026-07-12 after a structured design review; scope extended the same day
from 2 weeks to 4 weeks (ADR-007/008 added, several open items promoted into scope). Each decision
below records the context, the decision, and the consequences, ADR-style.

---

## ADR-001 — Map scope: one map per GenAI job (original lecture)

**Context.** ViBe's GenAI pipeline takes one uploaded lecture video per job and splits it into many
short Video items (~2–14 min each; a live 10-hour course has 275 video items) published into a
target section. A map per short video would hold 1–3 concepts (useless); a map per course would
hold 100+ (unreadable); merging maps across jobs into one section map requires concept
deduplication and cross-lecture prerequisite inference.

**Decision.** One concept map per GenAI job, i.e. per original uploaded lecture (typically 8–20
concepts). The student sees it at the section level, covering all the short video items that
lecture produced.

**Consequences.** Generation slots into the existing per-job task pipeline where the full lecture
transcript is already available in one place. Each concept node stores the full address
(`courseVersionId / moduleId / sectionId / videoItemId / offsetSeconds`) so a future section- or
course-level rollup is a query plus one LLM dedup pass, not a schema migration. Cross-lecture
merging is explicitly out of scope for v1.

## ADR-002 — Map style: hierarchical (Novak) with prerequisite-only edges

**Context.** Concept-map families considered: hierarchical/Novak (top-down, ordered), spider/radial
(membership, no order), flowchart (watch order — duplicates the existing timeline), and free
network/knowledge graph (rich but directionless, unstable layout). The feature's core promise is
"see what to learn first"; the cited literature (Novak 1984, Ausubel's advance organizers) backs
the hierarchical form.

**Decision.** Hierarchical top-down layout. Edges carry exactly one relation: *prerequisite-of*
("understand A before B"). The graph must be a DAG.

**Consequences.** The LLM output contract is small and validatable (cycle detection is the
correctness check). Layout is deterministic via dagre/elkjs auto-layout in React Flow. No edge
legend is needed — reading top→down *is* the learning order. Typed edge vocabularies
(part-of, example-of, …) and free-form Novak linking phrases are rejected for v1.

## ADR-003 — Generation: new CONCEPT_MAP pipeline task with teacher approval

**Context.** ViBe's pipeline is a human-in-the-loop task state machine
(`AUDIO_EXTRACTION → TRANSCRIPT_GENERATION → SEGMENTATION → QUESTION_GENERATION → UPLOAD_CONTENT`),
each task pausing at `WAITING` for teacher approval. Alternatives considered: on-demand
teacher-triggered generation on published videos, and student-triggered lazy generation (rejected:
students would see unreviewed LLM output; first-open latency; against the platform's
approve-everything culture).

**Decision.** Insert a `CONCEPT_MAP` task into the job state machine **after SEGMENTATION** (it
needs only transcript + segment boundaries). The teacher previews the rendered map at the task's
`WAITING` step and either approves or regenerates — no editing in v1 (node deletion/renaming is a
documented follow-up). `UPLOAD_CONTENT` resolves each concept's segment anchor to the real
`videoItemId` at publish time, since items do not exist before then.

**Consequences.** The map is generated once and served cheaply forever. The teacher approve/start/
continue flow and its UI are reused wholesale; the student never sees an unapproved map. The task
is executed inside the backend itself (like `UPLOAD_CONTENT`), so it needs no support from the
external AI server and never reaches the webhook path.

## ADR-004 — LLM strategy: backend-direct Anthropic call with deterministic no-key fallback

**Context.** The repo already has a house pattern (`QuestionService`) of calling Anthropic directly
from the backend via `@anthropic-ai/sdk` using `ANTHROPIC_CRED`/`ANTHROPIC_MODEL` from
`backend/src/config/ai.ts`, with a guarded no-key path. Environments without a key must still be
able to run the pipeline end-to-end.

**Decision.** Follow the house pattern: when `ANTHROPIC_CRED` is set, extract concepts with a real
LLM call; when absent, produce a deterministic fallback map (concepts derived from segment
boundaries plus a few cross-links) so local development and ad-hoc local demos always work.

**Consequences.** The production path is genuinely LLM-powered; the no-key path never hard-fails.
The prompt contract requires the model to anchor every concept to a transcript chunk/segment id —
free-form timestamps from the LLM are never trusted (hallucination guard).

## ADR-005 — Student UX: one surface, organizer + navigator, respecting progression rules

**Context.** The player enforces two course-configurable restrictions: `seekForwardEnabled`
(default **off** — forward seeks inside a video are blocked) and `linearProgressionEnabled`
(items ahead of the student's progress are locked). A map that freely seeks anywhere would bypass
rules teachers configured deliberately.

**Decision.** One panel serves both roles: shown at section/video start as the advance organizer
and available during playback as the navigator, with the current concept highlighted. Node clicks
**respect the course's rules**: concepts in watched/unlocked items navigate (and seek backward
freely); concepts in locked-ahead items render as "upcoming" — visible with description (organizer
value intact) but not navigable. On courses with free seek/progression, every node is navigable.

**Consequences.** No conflict with proctoring or linear progression; the map lights up as the
student advances, turning the restriction into visible progress. Navigation efficiency claims (H1)
apply to the review/revisit scenario, which the restrictions permit.

## ADR-006 — Persistence: dedicated `conceptmaps` collection

**Context.** Alternatives: embed the map in the section/itemsGroup document (bloats core course
reads; entangles an additive feature with core schemas) or leave it on the GenAI job record
(students querying teacher-side job records is an authorization smell; dies with job cleanup).

**Decision.** A new module-owned `conceptmaps` collection: one document per job's approved map,
keyed by `courseVersionId + sectionId`, each node carrying `videoItemId + offsetSeconds` (resolved
at `UPLOAD_CONTENT`). Students fetch via a dedicated read route (e.g.
`GET /concept-maps/section/:sectionId`) guarded by enrollment-based authorization.

**Consequences.** No existing schema changes — the feature stays additive as promised in the
proposal. Section/course-level rollups later are queries. The map survives job cleanup.

## ADR-007 — Zero-impact and cost guardrails

**Context.** The feature ships into a working production platform as a research contribution; the
bar is that existing behavior is unchanged when the feature is unused, and running it must be
cheap enough that cost is never an adoption objection.

**Decision.** Hard guarantees, enforced in review and re-verified before merge:
*additive-only* (new `conceptmaps` collection, new routes/abilities; no existing schema or route
modified); *legacy immunity* (job docs without `jobStatus.conceptMap` skip the task at every
backend touch point); *kill switch* (`CONCEPT_MAP_ENABLED` env, default on — off restores
pre-feature behavior platform-wide); *silent absence* (no map ⇒ pipeline and student page behave
exactly as today); *bundle isolation* (React Flow lazy-loaded). Cost: at most one LLM call per
lecture ever (plus explicit regenerations, ≤2 calls with the critique pass), Haiku-class model via
existing `ANTHROPIC_MODEL`, ~25-node output cap, one-retry budget, $0 fallback path, no LLM in any
student-facing path, no new infrastructure.

**Consequences.** Rollout risk approaches zero and the per-lecture cost is a few cents; a
275-video course maps for roughly the price of a coffee. The kill switch and legacy rule add a
small amount of conditional logic to the task machinery, covered by dedicated tests.

## ADR-008 — Evaluation strategy: labeled simulation + technical benchmark (no human cohort)

**Context.** The proposal planned a 5-student qualitative evaluation; no student cohort is
available. Fabricating or implying human-subject results is not an option.

**Decision.** Two honest, automated evaluations replace it: (1) a **simulated
navigation-efficiency harness** (Playwright) measuring scripted "locate concept X" tasks under
timeline navigation vs map navigation — interaction counts, elapsed time, wrong-segment visits,
deterministic seeds; (2) a **generation-quality benchmark** scoring LLM maps against hand-built
gold-standard maps for 2–3 real lectures (node recall/precision, edge agreement, DAG validity
rate). Both are reported explicitly as system measurements — H1 becomes a mechanical claim about
the navigation system; H2/H3 (learning, confidence) are stated as future work pending a real user
study. Any informal peer runs are a labeled bonus pilot, never the headline.

**Consequences.** The write-up gains reproducible numbers (something a 5-person observation could
not give) at the cost of not claiming human-learning outcomes. Research integrity is preserved;
the harness doubles as a regression suite for the feature.

---

## Open items (tracked, not blocking)

- **Section-level merged maps** (multi-lecture sections) — designed-for via node addressing,
  still deferred (cross-lecture dedup + prerequisite inference is its own project).
- **Full teacher map editing** (rename, add edges, re-anchor) — still deferred; v1.5 has node
  deletion only.
- **Human user study** for H2/H3 — future work; telemetry (week 4) is designed to support it when
  a cohort exists.

Promoted into scope by the 4-week extension (see implementation plan, week 3): quiz-linked
**mastery overlay**, **within-item offset seek**, **teacher node deletion** at approval, and
**retroactive generation** for already-published courses.
