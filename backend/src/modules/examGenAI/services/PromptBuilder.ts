import { ExamGenDifficultyLevel, ExamGenSubject, IGeneratedQuestion } from '../classes/transformers/ExamGenAI.js';

/**
 * Few-shot seed questions, one hardcoded set per subject family (math / CS /
 * generic-fallback), per this module's hard requirement. These are shown to
 * the generator on every call as "what 'good' looks like" — multi-step
 * reasoning, subtle distractors, no logistics/external-resource references.
 */
const SEED_QUESTIONS: Record<'math' | 'cs' | 'generic', IGeneratedQuestion> = {
    math: {
        question:
            'A function f is twice differentiable on all reals, with f\'(2) = 0 and f\'\'(2) = -3. ' +
            'A student claims that because f\'(2) = 0, the value f(2) must be a local minimum. ' +
            'Which statement correctly evaluates this claim?',
        options: [
            'The claim is correct, since f\'(2) = 0 always indicates a local extremum',
            'The claim is incorrect: f\'\'(2) < 0 means f(2) is a local maximum, not a minimum',
            'The claim is correct, since f\'\'(2) being negative confirms a local minimum',
            'Neither conclusion can be drawn without also knowing f(2) itself',
        ],
        answer: 'The claim is incorrect: f\'\'(2) < 0 means f(2) is a local maximum, not a minimum',
        explanation:
            'The second derivative test: f\'(2) = 0 identifies a critical point, and f\'\'(2) < 0 ' +
            'classifies it as a local maximum (concave down), not a minimum. The student correctly ' +
            'identified a critical point but misapplied the concavity test.',
        difficulty: 6,
        key_concepts: ['critical points', 'second derivative test', 'concavity'],
    },
    cs: {
        question:
            'A hash table with open addressing uses linear probing and is currently at 90% load factor. ' +
            'A colleague suggests switching to a hash table with separate chaining at the same load factor ' +
            'to improve average-case lookup time. Under which condition is this suggestion most justified?',
        options: [
            'It never helps — separate chaining and linear probing have identical average-case behavior at any load factor',
            'It helps because separate chaining\'s expected lookup cost grows roughly linearly with load factor, while linear probing degrades faster due to clustering',
            'It only helps if the hash function is cryptographically secure',
            'It helps only when the table is resized to a prime number of buckets',
        ],
        answer:
            'It helps because separate chaining\'s expected lookup cost grows roughly linearly with load factor, while linear probing degrades faster due to clustering',
        explanation:
            'At high load factors, linear probing suffers from primary clustering, pushing expected probe ' +
            'count toward O(1/(1-α)²)-like degradation, while separate chaining\'s expected chain length ' +
            'stays close to the load factor α itself — so at 90% load, chaining\'s advantage is real, not ' +
            'a hash-function or resizing artifact.',
        difficulty: 7,
        key_concepts: ['hash tables', 'load factor', 'open addressing', 'separate chaining'],
    },
    generic: {
        question:
            'A researcher observes that a treatment group shows a statistically significant improvement ' +
            '(p = 0.03) over a control group, in a study with only 12 participants per group. A second ' +
            'researcher argues the result should be treated with caution despite the significant p-value. ' +
            'What is the strongest justification for that caution?',
        options: [
            'A p-value below 0.05 is only valid for sample sizes above 1000',
            'With such a small sample, the study likely has low statistical power, so a "significant" ' +
            'result is more sensitive to random variation and may not replicate',
            'Statistical significance with p = 0.03 already implies the effect is not due to chance, so no caution is warranted',
            'Two-group comparisons can never yield valid p-values regardless of sample size',
        ],
        answer:
            'With such a small sample, the study likely has low statistical power, so a "significant" ' +
            'result is more sensitive to random variation and may not replicate',
        explanation:
            'Small samples inflate the variance of the effect-size estimate; a nominally significant ' +
            'result from an underpowered study is more likely to be an overestimate driven by sampling ' +
            'noise ("winner\'s curse"), not evidence the effect is unusually strong.',
        difficulty: 5,
        key_concepts: ['statistical power', 'p-values', 'sample size', 'replication'],
    },
};

function seedFor(subject: ExamGenSubject): IGeneratedQuestion {
    if (subject === 'mathematics' || subject === 'statistics' || subject === 'physics') return SEED_QUESTIONS.math;
    if (subject === 'computer_science') return SEED_QUESTIONS.cs;
    return SEED_QUESTIONS.generic;
}

function formatQuestion(q: IGeneratedQuestion, label: string): string {
    return (
        `[${label}] (difficulty ${q.difficulty}/10)\n` +
        `Q: ${q.question}\n` +
        `Options: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(' | ')}\n` +
        `Answer: ${q.answer}\n` +
        `Key concepts: ${q.key_concepts.join(', ')}`
    );
}

export interface CourseMaterials {
    courseName: string;
    subject: ExamGenSubject;
    courseDescription: string;
    syllabus: string;
    pastExamContent?: string;
}

const GENERATOR_RULES = `
Rules for the question you write:
- It must require multi-step reasoning to solve, not a single formula plug-in.
- Distractors (wrong options) must be subtle and plausible — mistakes a student who
  misapplies a concept would actually make — never obviously wrong or silly.
- Do NOT reference syllabus logistics (office hours, due dates, submission format,
  grading policy, course platform) — test course CONCEPTS only.
- Do NOT reference external resources the student wouldn't have in front of them
  (statistical tables, specific software/calculator functions, textbook page numbers).
- The question must be solvable mentally/on paper in under 5 minutes, with no calculator.
- LENGTH LIMITS (strict — questions that run long are hard to read on an exam sheet):
  the question stem must be under 60 words (~350 characters); each option must be under
  20 words (~120 characters). Be concise — cut setup/flavor text that isn't load-bearing
  for solving the problem.
- Exactly 4 options, exactly one of which is correct (its text must appear verbatim in "options").
- Do NOT prefix any option with its own letter or number label (e.g. "A)", "B.", "1)", "iii)").
  The exam UI already adds the letter label automatically — an option's text must start
  directly with its actual content, never with a label that duplicates it.
- Code, pseudocode, array/index notation (e.g. L[i][j], arr[k]), and short formulas MUST be
  wrapped in a single pair of backtick characters wherever they appear in the question or
  options (the same way inline code is marked in Markdown), so they render in monospace
  instead of wrapping like ordinary prose.
- Return ONLY a single valid JSON object — no markdown fences, no prose before or after it.
  Required fields: question (string), options (array of exactly 4 strings), answer (string,
  exact text of the correct option), explanation (string), difficulty (integer 1-10),
  key_concepts (array of strings).`.trim();

/** Maps the user-facing Easy/Medium/Hard/Mixed selector to concrete guidance
 *  for the generator — both a target difficulty NUMBER range (matching the
 *  1-10 `difficulty` field it already self-reports) and a description of
 *  what that means in practice, since "difficulty 7" alone is ambiguous to
 *  a model with no other calibration. */
function difficultyGuidance(level: ExamGenDifficultyLevel): string {
    switch (level) {
        case 'easy':
            return 'TARGET DIFFICULTY: EASY (self-report difficulty 2-4/10). The question should test a ' +
                'single core concept clearly, with straightforward (if not one-step) reasoning — the kind ' +
                'of question most students who attended class and did the reading should get right.';
        case 'medium':
            return 'TARGET DIFFICULTY: MEDIUM (self-report difficulty 4-7/10). The question should require ' +
                'combining two related ideas or applying a concept in a moderately unfamiliar way — ' +
                'noticeably harder than a definition-recall question, but not a multi-concept synthesis.';
        case 'hard':
            return 'TARGET DIFFICULTY: HARD (self-report difficulty 7-10/10). The question should require ' +
                'synthesizing multiple concepts, reasoning through a non-routine scenario, or catching a ' +
                'subtle misconception — the kind of question only strong students reliably get right.';
        case 'mixed':
        default:
            return 'TARGET DIFFICULTY: MIXED. Vary difficulty naturally across questions (roughly spanning ' +
                '2-10/10 self-reported) rather than converging on one difficulty level.';
    }
}

export function buildGeneratorPrompt(
    materials: CourseMaterials,
    goodExamples: IGeneratedQuestion[],
    badExamples: IGeneratedQuestion[],
    difficultyLevel: ExamGenDifficultyLevel,
    coveredConcepts: string[],
): { system: string; prompt: string } {
    const seed = seedFor(materials.subject);
    const goodBlock = [seed, ...goodExamples]
        .map((q, i) => formatQuestion(q, `GOOD EXAMPLE ${i + 1}`))
        .join('\n\n');
    const badBlock = badExamples.length
        ? badExamples.map((q, i) => formatQuestion(q, `REJECTED EXAMPLE ${i + 1} — do not repeat this style/topic`)).join('\n\n')
        : '(none yet)';
    // Every key concept approved so far in THIS job, not just the last
    // `feedbackExampleCount` examples shown above — without this, the
    // generator only sees a rolling window of recent topics and nothing
    // stops it converging on one syllabus topic once it finds a style that
    // reliably passes the judge (observed: reports of exams "generating on
    // a single topic"). This list is deliberately unbounded so the
    // instruction below can actually enforce coverage across the whole run.
    const coveredBlock = coveredConcepts.length
        ? [...new Set(coveredConcepts)].join(', ')
        : '(none yet — this is the first question)';

    const prompt = `
You are writing ONE multiple-choice exam question for the course below.

COURSE: ${materials.courseName}
SUBJECT: ${materials.subject}

COURSE DESCRIPTION:
${materials.courseDescription}

SYLLABUS:
${materials.syllabus}

${materials.pastExamContent ? `PAST EXAM / HOMEWORK CONTENT (for style/topic grounding):\n${materials.pastExamContent}\n` : ''}

Examples of GOOD questions (this style/rigor is what you're aiming for — do not copy
their topics verbatim, write a NEW question in the same spirit, grounded in the course
materials above):
${goodBlock}

Examples that were REJECTED (avoid these mistakes: logistics questions, external-resource
references, single-step formula plug-ins, obviously-wrong distractors, or duplicating a
concept already covered by a GOOD example above):
${badBlock}

CONCEPTS ALREADY TESTED BY APPROVED QUESTIONS IN THIS EXAM (across the whole run so far,
not just the examples shown above): ${coveredBlock}
TOPIC COVERAGE REQUIREMENT: This question must test a DIFFERENT concept/topic from the
syllabus than every concept listed above — pick a topic from a different week/section of
the syllabus than what's already been covered. Do not write a question that is a minor
variation of an already-tested concept. If most of the syllabus is already covered, find
the least-tested area rather than doubling up on a popular one.

${difficultyGuidance(difficultyLevel)}

${GENERATOR_RULES}`.trim();

    return {
        system:
            'You are an expert exam-question writer. You always reply with exactly one raw JSON object and nothing else. ' +
            'If your reasoning process is visible (e.g. a <think> block), keep it SHORT — a few sentences at most — ' +
            'then immediately write the final JSON object. Never spend your full response budget on reasoning alone.',
        prompt,
    };
}

export function buildJudgePrompt(
    materials: CourseMaterials,
    candidate: IGeneratedQuestion,
    goodExamples: IGeneratedQuestion[],
    coveredConcepts: string[],
): string {
    // `goodExamples` is only the last `feedbackExampleCount` approved
    // questions (shown for style calibration); `coveredConcepts` is every
    // concept approved so far in the whole job — using only the former here
    // let duplicate topics slip through once the run got past
    // feedbackExampleCount questions, since an already-tested concept could
    // scroll out of the recent-examples window while still needing to be
    // rejected as a repeat.
    const allConcepts = [...new Set([...goodExamples.flatMap(q => q.key_concepts), ...coveredConcepts])];
    return `
You are screening ONE candidate exam question for the course "${materials.courseName}" (${materials.subject}).

COURSE MATERIALS (for checking the concept actually belongs to this course):
${materials.courseDescription}
${materials.syllabus}

CANDIDATE QUESTION:
${formatQuestion(candidate, 'CANDIDATE')}

Already-approved key concepts so far, across the ENTIRE exam being built (reject if this
candidate duplicates or is a minor variation of any of these):
${allConcepts.length ? allConcepts.join(', ') : '(none yet)'}

Reject ("Remove") the candidate if ANY of the following is true:
- It tests syllabus logistics (office hours, due dates, submission rules, grading policy) instead of course content.
- It references an external resource the student wouldn't have available (a printed table, specific software, a textbook page number).
- Its core tested concept duplicates one already in the approved list above.
- Its core concept does not actually appear anywhere in the course materials provided.
- It is a single-step formula plug-in rather than requiring multi-step reasoning.
- Its wrong options are obviously wrong rather than plausible distractors.
- The question stem is over 60 words, or any option is over 20 words (too long for an exam sheet).
- Any option text is prefixed with its own letter/number label (e.g. starts with "A)", "B.", "1)") —
  the exam UI already adds that label, so a duplicated one would show as "A. A) ...".
- The question or options contain code, pseudocode, or array/index notation (e.g. L[i][j]) that is
  NOT wrapped in single backticks.

Otherwise ("Keep") the candidate is acceptable.

Reply with EXACTLY one word: "Keep" or "Remove". Nothing else — no punctuation, no explanation.`.trim();
}

export function buildFinalJudgePrompt(materials: CourseMaterials, candidate: IGeneratedQuestion): string {
    return `
You are doing a final quality check on ONE exam question for the course "${materials.courseName}" (${materials.subject}), before it ships to students.

COURSE MATERIALS:
${materials.courseDescription}
${materials.syllabus}

QUESTION TO CHECK:
${formatQuestion(candidate, 'CANDIDATE')}
Explanation given: ${candidate.explanation}

Re-derive the answer yourself from first principles — do not just trust the "Answer" field above.

Return ONLY a single valid JSON object — no markdown fences, no prose — with exactly these fields:
{
  "difficulty": <integer 1-10, your own independent assessment of how hard this question actually is>,
  "is_appropriate": <boolean — true unless it tests logistics, references an external resource, or is otherwise unsuitable for a timed written exam>,
  "answer_confirmed": <boolean — true only if you independently re-derived the same answer marked as correct>
}`.trim();
}
