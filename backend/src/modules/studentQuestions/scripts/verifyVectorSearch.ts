/**
 * End-to-end proof that the vector path actually works.
 *
 *   npx tsx src/modules/studentQuestions/scripts/verifyVectorSearch.ts
 *
 * Everything else in this feature is covered by unit tests with a stubbed store.
 * The one thing they CANNOT cover is `$vectorSearch` itself — it is an Atlas-only
 * aggregation stage, so it has to be exercised against a live cluster. This script
 * is that exercise: it seeds a throwaway segment, embeds real text with the real
 * model, queries Atlas, and checks the decisions the pipeline would make.
 *
 * It writes only to its own scratch segment on VECTOR_DB_URL and deletes it after,
 * so it never touches anything else.
 */
import 'dotenv/config';
import {ObjectId} from 'mongodb';
import {screeningConfig} from '#root/config/screening.js';
import {QuestionVectorRepository} from '../repositories/providers/mongodb/QuestionVectorRepository.js';
import {VectorDedupService} from '../services/screening/VectorDedupService.js';
import {LocalEmbeddingProvider} from '../services/screening/embeddings/LocalEmbeddingProvider.js';

/** A scratch segment nothing else uses, so the seeded vectors are isolated. */
const SEGMENT = new ObjectId('000000000000000000000001');

/** The question bank this demo pretends already exists. */
const BANK = [
  'what is the boiling point of water',
  'which of these is a type of machine learning',
  'who invented the telephone',
];

/**
 * Each probe states what the pipeline SHOULD do, so the script grades itself.
 * The expectations follow directly from the thresholds and the cosines measured in
 * embedding.calibration.test.ts — if a number here surprises you, re-run that test
 * rather than adjusting the expectation to match whatever came out.
 */
const PROBES: {q: string; expect: string; why: string}[] = [
  {
    q: 'what is the boiling point of water?',
    expect: 'auto_reject',
    why: 'near-identical restatement (~0.97) — this is the ONLY shape the fast path is safe on, and it costs zero LLM calls',
  },
  {
    q: 'at what temperature does water start boiling',
    expect: 'candidates',
    why: 'a real duplicate, but only ~0.81 — BELOW the 0.93 fast path, so the LLM judge decides. Deliberate: rewordings are exactly where cosine is unreliable',
  },
  {
    q: 'which of these is NOT a type of machine learning',
    expect: 'candidates',
    why: 'a valid, DIFFERENT question that embeddings score at ~0.92 against its opposite. Sitting below 0.93 is what keeps it from being auto-rejected — the whole reason the threshold is where it is',
  },
  {
    q: 'how do you train a neural network with backpropagation',
    expect: 'no_candidates',
    why: 'nothing in the bank is related — the LLM duplicate call is skipped entirely',
  },
];

const ok = (b: boolean) => (b ? '✅' : '❌');

async function run() {
  if (!screeningConfig.vector.dbUrl) {
    console.error('VECTOR_DB_URL is not set.');
    process.exit(1);
  }

  const repo = new QuestionVectorRepository();
  const embedder = new LocalEmbeddingProvider();
  const dedup = new VectorDedupService(repo);
  const {autoRejectAt, llmFloorAt, topK} = screeningConfig.vector;

  let failures = 0;

  try {
    console.log(`model        : ${embedder.model} (${embedder.dims}d)`);
    console.log(`autoRejectAt : ${autoRejectAt}   llmFloorAt: ${llmFloorAt}   topK: ${topK}\n`);

    // ── seed ────────────────────────────────────────────────────────────────
    console.log('seeding the scratch bank…');
    const vectors = await embedder.embed(BANK);
    await repo.upsertMany(
      BANK.map((text, i) => ({
        questionId: new ObjectId(),
        segmentId: SEGMENT,
        text,
        embedding: vectors[i],
        model: embedder.model,
        dims: embedder.dims,
      })),
    );
    BANK.forEach(b => console.log(`  + ${b}`));

    // Atlas builds the index asynchronously; a fresh write is not instantly
    // queryable, so wait for the seeded docs to actually surface.
    process.stdout.write('\nwaiting for Atlas to index');
    let visible = 0;
    for (let i = 0; i < 30 && visible < BANK.length; i++) {
      await new Promise(r => setTimeout(r, 2000));
      process.stdout.write('.');
      visible = (await repo.search(String(SEGMENT), vectors[0], topK)).length;
    }
    console.log(visible >= BANK.length ? ' indexed.\n' : '\n⚠️  index still catching up — results may be partial.\n');

    // ── probe ───────────────────────────────────────────────────────────────
    for (const p of PROBES) {
      const outcome = await dedup.findSimilar(String(SEGMENT), p.q);
      const pass = outcome.kind === p.expect;
      if (!pass) failures++;

      console.log(`${ok(pass)} "${p.q}"`);
      console.log(`   expected ${p.expect}, got ${outcome.kind}`);
      if (outcome.kind === 'auto_reject') {
        console.log(`   matched  "${outcome.match.text}"  (cosine ${outcome.match.cosine.toFixed(4)})`);
      }
      if (outcome.kind === 'candidates') {
        outcome.hits.forEach(h => console.log(`   candidate ${h.cosine.toFixed(4)}  "${h.text}"`));
      }
      console.log(`   ${p.why}\n`);
    }

    // ── the appeal ──────────────────────────────────────────────────────────
    // The fast-path rejection is a heuristic, not a verdict. Re-submitting the same
    // question as an appeal runs the same retrieval with the fast path disabled, so
    // the candidates reach the LLM judge instead of being bounced again.
    const APPEALED_Q = 'what is the boiling point of water?'; // the one that WAS auto-rejected
    const appealed = await dedup.findSimilar(
      String(SEGMENT),
      APPEALED_Q,
      /* allowAutoReject */ false,
    );
    const appealPass = appealed.kind === 'candidates';
    if (!appealPass) failures++;
    console.log(`${ok(appealPass)} APPEAL: "${APPEALED_Q}" re-submitted as "not a duplicate"`);
    console.log(`   got ${appealed.kind} — the fast path is skipped and the LLM judge decides (its verdict is final).\n`);

    console.log(failures === 0
      ? '════════ ✅ vector path verified end-to-end ════════'
      : `════════ ❌ ${failures} check(s) failed ════════`);
  } finally {
    // Clean up the scratch segment — this script owns nothing else.
    const coll = await (repo as any).coll();
    await coll.deleteMany({segmentId: SEGMENT});
    await repo.close();
  }

  process.exit(failures === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('failed:', err?.message ?? err);
  process.exit(1);
});
