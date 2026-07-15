/**
 * THRESHOLD CALIBRATION — run this, don't guess.
 *
 * Semantic similarity is a RETRIEVER, not a judge. The whole design rests on one
 * empirical question: is there a cosine band high enough that a duplicate is
 * certain (safe to auto-reject without an LLM), and is it cleanly above the
 * scores of questions that merely *look* alike?
 *
 * This prints the cosine for every labelled pair — real duplicates, near-misses,
 * and the traps the LLM judge was hardened against (same answer, different
 * problem; same setup, different ask). The two thresholds in `screeningConfig`
 * must be read off THIS output, not invented:
 *
 *   autoRejectAt  — above it, every DUP scores and no NOT-DUP does.
 *   llmFloorAt    — below it, nothing plausible exists, so the LLM call is skipped.
 *
 * If the bands overlap, auto-reject is UNSAFE at any threshold and must stay off.
 */
import {describe, it} from 'vitest';
import {LocalEmbeddingProvider} from '../services/screening/embeddings/LocalEmbeddingProvider.js';
import {cosine} from '../services/screening/embeddings/EmbeddingProvider.js';

type Pair = {label: string; a: string; b: string};

/** Labelled TRUE duplicates — a correct system must catch all of these. */
const DUPLICATES: Pair[] = [
  {label: 'dup1 no-overlap', a: 'describe ai', b: 'what is the meaning of ai'},
  {label: 'dup2 no-overlap', a: 'what does the term artificial intelligence refer to', b: 'define ai'},
  {label: 'dup3 reworded', a: 'at what temperature does water start boiling', b: 'what is the boiling point of water'},
  {label: 'dup4 reworded', a: 'who is credited with inventing the telephone', b: 'who invented the telephone'},
  {label: 'commutative math', a: 'what is 1 + 3', b: 'what is 3 + 1'},
  {label: 'exact restatement', a: 'what is supervised learning', b: 'what is supervised learning?'},
];

/** Labelled NOT duplicates — auto-rejecting any of these would be a false reject. */
const NOT_DUPLICATES: Pair[] = [
  {label: 'nd1 shared words', a: 'who invented ai', b: 'what is ai'},
  {label: 'nd2 shared words', a: 'what are the risks of ai', b: 'what is ai'},
  {label: 'nd3 shared words', a: 'how is a neural network trained', b: 'what is a neural network'},
  // The traps the strict-judge prompt exists for — embeddings are expected to
  // score these HIGH. If they land in the auto-reject band, auto-reject is unsafe.
  {label: 'TRAP same answer, diff problem', a: 'what is 2 + 2', b: 'what is 3 + 1'},
  {label: 'TRAP same setup, diff ask', a: 'what is the boiling point of water', b: 'what is the freezing point of water'},
  {label: 'TRAP isomorphic problem', a: 'what is 15% of 200', b: 'what is 25% of 400'},

  // NEGATION — the failure mode that decides whether auto-reject is viable at all.
  // Embeddings barely register "not"/"except"/"incorrect", so these pairs are
  // near-identical in vector space while being opposite questions. A threshold is
  // only safe if EVERY one of these stays below it.
  {label: 'NEG inverted MCQ ask', a: 'which of these is a type of machine learning', b: 'which of these is NOT a type of machine learning'},
  {label: 'NEG is/is-not prime', a: 'which of the following is a prime number', b: 'which of the following is not a prime number'},
  {label: 'NEG true/false stmt', a: 'which statement about photosynthesis is true', b: 'which statement about photosynthesis is false'},
  {label: 'NEG correct/incorrect', a: 'select the correct statement about neural networks', b: 'select the incorrect statement about neural networks'},
  {label: 'NEG valid/invalid', a: 'which option is a valid python variable name', b: 'which option is an invalid python variable name'},
  {label: 'NEG except', a: 'all of these are supervised algorithms', b: 'all of these are supervised algorithms except'},
  {label: 'NEG should/should-not', a: 'what should you do when the model overfits', b: 'what should you not do when the model overfits'},
  {label: 'NEG advantage/disadvantage', a: 'what is an advantage of using a neural network', b: 'what is a disadvantage of using a neural network'},

  // Same template, different givens — a very common student pattern.
  {label: 'PARAM same template diff number', a: 'what is 15% of 200', b: 'what is 15% of 300'},
  {label: 'PARAM same setup diff value', a: 'a train travels 60 km in 2 hours, what is its speed', b: 'a train travels 90 km in 2 hours, what is its speed'},
];

const pct = (n: number) => n.toFixed(4);

describe('embedding threshold calibration', () => {
  it('prints cosine for labelled duplicate / non-duplicate pairs', async () => {
    const provider = new LocalEmbeddingProvider();

    const score = async (p: Pair) => {
      const [va, vb] = await provider.embed([p.a, p.b]);
      return cosine(va, vb);
    };

    const dupScores: {label: string; s: number}[] = [];
    const notScores: {label: string; s: number}[] = [];

    console.log(`\nmodel: ${provider.model} (${provider.dims}d)\n`);
    console.log('── TRUE DUPLICATES (must be caught) ──');
    for (const p of DUPLICATES) {
      const s = await score(p);
      dupScores.push({label: p.label, s});
      console.log(`  ${pct(s)}  ${p.label.padEnd(30)} "${p.a}"  vs  "${p.b}"`);
    }

    console.log('\n── NOT DUPLICATES (must NOT be auto-rejected) ──');
    for (const p of NOT_DUPLICATES) {
      const s = await score(p);
      notScores.push({label: p.label, s});
      console.log(`  ${pct(s)}  ${p.label.padEnd(30)} "${p.a}"  vs  "${p.b}"`);
    }

    const minDup = Math.min(...dupScores.map(d => d.s));
    const maxNot = Math.max(...notScores.map(d => d.s));
    const worstNot = notScores.find(d => d.s === maxNot)!;
    const worstDup = dupScores.find(d => d.s === minDup)!;

    console.log('\n════════ VERDICT ════════');
    console.log(`  lowest  TRUE-duplicate : ${pct(minDup)}  (${worstDup.label})`);
    console.log(`  highest NON-duplicate  : ${pct(maxNot)}  (${worstNot.label})`);

    // Test the proposed auto-reject threshold against every labelled pair.
    const PROPOSED = 0.93;
    const falseRejects = notScores.filter(d => d.s >= PROPOSED);
    const caught = dupScores.filter(d => d.s >= PROPOSED);
    console.log(`\n  ── proposed autoRejectAt = ${PROPOSED} ──`);
    console.log(`     duplicates it would catch : ${caught.length}/${dupScores.length}`);
    console.log(`     FALSE REJECTS             : ${falseRejects.length}/${notScores.length}`);
    falseRejects.forEach(f => console.log(`        🚨 ${pct(f.s)}  ${f.label}`));
    console.log(`     margin to nearest non-dup : ${pct(PROPOSED - maxNot)}`);


    if (maxNot < minDup) {
      const safe = (maxNot + minDup) / 2;
      console.log(`  ✅ SEPARABLE — bands do not overlap.`);
      console.log(`     autoRejectAt can sit at ~${pct(safe)} (above every non-dup, below every dup)`);
    } else {
      console.log(`  ⚠️  OVERLAP — a non-duplicate scores HIGHER than a real duplicate.`);
      console.log(`     No single cosine can separate them. Auto-reject is UNSAFE:`);
      console.log(`     set autoRejectAt above ${pct(maxNot)} (so it only fires on near-identical text),`);
      console.log(`     or disable it entirely and let the LLM judge every candidate.`);
    }
    console.log(`\n  llmFloorAt: pick just BELOW the lowest true duplicate (${pct(minDup)}) —`);
    console.log(`  anything under it has no plausible duplicate, so the LLM call can be skipped.\n`);
  }, 180000);
});
