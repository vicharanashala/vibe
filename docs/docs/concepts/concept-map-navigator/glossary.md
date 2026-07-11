# Concept Map Navigator — Glossary

Shared vocabulary for the feature. Terms are used with exactly these meanings in the design
decisions, code, and PR discussion.

**Concept** — A single teachable idea extracted from a lecture transcript (e.g. "Express
middleware"). Rendered as one node. Every concept is *anchored* (see Anchor); a concept the LLM
cannot anchor to a transcript chunk is discarded.

**Concept Map** — The set of concepts and prerequisite edges produced from one GenAI job (one
original lecture). A directed acyclic graph (DAG), laid out hierarchically top-down.

**Prerequisite edge** — The only edge type in v1. `A → B` means "understand A before B". Cycles are
invalid; the generator validates acyclicity before the map is stored.

**Original lecture** — The single long video a teacher uploads to the GenAI pipeline; one GenAI
*job* processes it. The pipeline splits it into multiple short **Video items** (~2–14 min) published
into a target **section**.

**Segment** — A time range of the original lecture produced by the SEGMENTATION task. Each segment
becomes one Video item (plus quiz) at UPLOAD_CONTENT. Transcript chunks carry `[start, end]`
timestamps that map into segments.

**Anchor** — A concept's pointer to where it is taught: segment id during generation, resolved to
`(videoItemId, offsetSeconds)` at publish time. Anchors come from transcript chunk boundaries, never
from free-form LLM timestamps.

**CONCEPT_MAP task** — New task in the job state machine, after SEGMENTATION. Follows the standard
`PENDING → WAITING → RUNNING → COMPLETED/FAILED` lifecycle with teacher approve/start/continue.

**Advance organizer** — (Ausubel) A structural preview shown *before* learning that primes the
learner's mental model. The map plays this role when opened before/at the start of a section.

**Navigator** — The same map during playback: the current concept is highlighted as the video
plays, and clicking an unlocked concept navigates to its anchor.

**Upcoming node** — A concept whose anchor lies in a video item the student cannot reach yet
(course has `linearProgressionEnabled`, or the target is forward of the current position with
`seekForwardEnabled` off). Visible with its description, styled as locked, not navigable.

**Deterministic fallback map** — The map produced without `ANTHROPIC_CRED`: concepts derived from
segment boundaries plus a small set of cross-links. Keeps local dev and offline demos working; not
used when a real key is configured.

**Approved map** — The map after the teacher approves the CONCEPT_MAP task. Only approved maps are
persisted to the `conceptmaps` collection and visible to students.

**Mastery overlay** — Per-student node coloring derived from existing quiz-attempt data:
`mastered` (the concept's segment quiz passed), `weak` (attempted, not passed — the "revisit this"
signal), neutral (not reached). Read-only join; no new writes.

**Kill switch** — The `CONCEPT_MAP_ENABLED` env flag (default on). Off: new jobs follow the legacy
path with no CONCEPT_MAP task and the student route returns empty — pre-feature behavior restored
platform-wide with one flip.

**Evaluation harness** — The Playwright simulation measuring scripted "locate concept X" tasks
under timeline vs map navigation. Measures the system's navigation mechanics; always reported as a
simulation, never as a human study.

**Gold-standard map** — A hand-built reference concept map for a real lecture transcript, used to
score LLM output (node recall/precision, edge agreement, DAG validity rate).
