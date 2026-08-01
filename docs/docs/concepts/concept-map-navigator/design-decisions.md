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

## ADR-009 — Reversal: Novak linking phrases, added after all (post-v1 add-on)

**Context.** ADR-002 rejected free-form Novak linking phrases for v1 to keep the LLM output
contract small and validatable. After core delivery, a comparison against Stanford CTL's own
concept-mapping handout (linking phrases on every edge, e.g. "acceleration *is inversely
proportional to* mass") showed that a bare prerequisite arrow reads as "comes before" but not
*why* — the map's pedagogical value (Novak's actual method) was left on the table.

**Decision.** Add an optional `label` (1–3 words) to each prerequisite edge, generated in the
*same* LLM call as node labels (no extra cost) and rendered as "`<from> <label> <to>`"; sanitized
(trimmed, dropped if empty or >30 chars) and validated identically on both the LLM and fallback
paths. Deterministic-fallback edges get fixed labels ('leads to' / 'supports'). Maps generated
before this field existed simply have no label (renders as a plain arrow) — no backfill, no schema
migration, consistent with ADR-006/007's additive-only guarantee.

**Consequences.** Zero additional LLM calls; the validation surface grows by one optional string
field per edge. Paired with a hover **focus mode** (dim everything but the hovered node's
neighbors and incident edges) so a crowded map stays readable while a student traces one
relationship at a time. When the whole map has one root with every other concept pointing directly
at it — the shape the deterministic fallback now always produces, and one real LLM maps sometimes
converge on — the panel renders it as a **radial hub-and-spoke** layout (own polar-coordinate
positions + quadratic-bezier edges) instead of dagre's top-down rows, closer to a hand-drawn mind
map than an org chart. A **guided study plan** (prerequisite closure of the student's weak
concepts, topologically ordered) was added alongside the map as a concrete "what do I review, in
what order" answer, reusing the same DAG.

## ADR-010 — Mastery display: BKT tried, then simplified to raw quiz score

**Context.** A first pass (promoted into scope after a professor asked for more algorithmic depth,
see implementation plan week 3 item 18) computed per-node mastery with Bayesian Knowledge Tracing
(Corbett & Anderson) over each student's ordered per-question answer history — a real probabilistic
model, but its output (a mastery *probability*, driven by four hidden parameters: guess, slip,
initial-knowledge, and per-attempt learning rate) is opaque to explain live and hard to sanity-check
against what a viewer can see on screen.

**Decision.** Replace the BKT estimate with the student's best raw quiz score percentage
(0–100%) for the node's segment quiz — the same number the student already sees on their quiz
result. The `outcomes` field (`mastered`/`weak`, driving node color) is unchanged; only the
secondary numeric badge and the study plan's weak/strong classification (now the same quiz outcome
used everywhere else, not a probability threshold) changed. The BKT service and its tests are
removed rather than kept dead.

**Consequences.** A simpler, fully explainable metric at the cost of the probabilistic modeling
depth BKT offered. If richer per-concept modeling is wanted again later, BKT (or an Elo-style
rating, see future work) is a self-contained, independently re-addable slice — nothing else in the
map depends on which mastery metric feeds the badge.

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
**retroactive generation** for already-published courses. Promoted after core delivery (ADR-009):
**Novak linking phrases**, **focus mode**, **radial hub layout**, and a **guided study plan**.

## Future work (surveyed, deliberately out of scope for this PR)

Considered and parked after a survey done in response to reviewer feedback that the feature needed
more research-backed, algorithm-heavy substance (the result was ADR-009/010 above plus the items
below, kept out to avoid widening this PR further):

- **Class-level progress heatmap.** A teacher-facing view aggregating every enrolled student's node
  outcomes into one per-concept bottleneck signal ("40% of the class is weak on Chain Rule"). Was
  built and browser-verified once, then removed before commit — it's only reachable right after
  publish (no jobs-list page exists yet to route back to it), and a live demo has nowhere natural to
  show it. Revive alongside Elo below, once a general jobs/courses list view exists to host it.
- **Elo-style difficulty rating.** Concepts and students both get a rating that updates after each
  quiz attempt (classic Elo/Glicko update), giving a difficulty ranking across concepts for free and
  a second, independent mastery signal. Only pays off once there's a class-level view to show
  concept difficulty across students — parked with the heatmap.
- **Ontology / course-level concept graph.** Merge concept maps across lectures and courses into one
  deduplicated graph (the cross-lecture merge ADR-001 explicitly deferred), enabling "what do I need
  from other courses" queries. Real value, but concept deduplication + cross-lecture prerequisite
  inference is its own project, not an incremental add.
- **Personalized PageRank for root-cause weak concepts.** Instead of just flagging weak nodes, run
  PPR seeded from a student's weak concepts over the prerequisite DAG to rank *which upstream
  concept* most explains the weakness — turning "you're weak here" into "start your review here."
  Cheapest of the surveyed items to bolt on later (pure graph computation, no new data).
- **Forgetting-curve / contagion-style forecasting.** Model mastery decay over time (FSRS-style) and
  simulate how a weak concept's effect propagates to dependents, to predict which concepts will
  become weak next rather than only reporting what already is. Highest-effort, most speculative of
  the surveyed items.

None of these are started; they are recorded here so the next iteration doesn't need to
re-research the space.
