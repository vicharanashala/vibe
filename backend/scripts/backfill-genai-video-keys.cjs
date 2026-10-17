/*
 * Backfill `videoKey` on existing genAI_jobs.
 *
 * Jobs record whatever URL the instructor pasted, so looking one up from a
 * course item's video URL by raw string equality misses jobs that plainly
 * exist — `scripts/backfill-segment-transcripts.cjs` does exactly that, and its
 * `noJob` counter has been recording the misses. `videoKey` normalises the URL
 * to `yt:<videoId>` so the lookup is exact and indexable.
 *
 * New jobs get the field on insert (GenAIRepository.save). This backfills the
 * ones written before it existed; until it runs, findRecentByVideoKey falls
 * back to a collection scan, so this is a performance and coverage fix rather
 * than a correctness one.
 *
 * Usage (from backend/, so .env DB_URL resolves):
 *   node scripts/backfill-genai-video-keys.cjs           # DRY RUN (no writes)
 *   APPLY=1 node scripts/backfill-genai-video-keys.cjs   # write videoKey
 *
 * Dry-run is the default; nothing is written unless APPLY=1. Re-running is
 * safe: jobs that already carry a matching videoKey are skipped.
 *
 * The normaliser below is duplicated from src/modules/genAI/utils/videoKey.ts
 * because that module is ESM/TypeScript and these scripts are plain CJS. The
 * two are pinned together by a parity test in
 * src/modules/genAI/tests/videoKey.test.ts, which imports both and asserts they
 * agree — keep them in step or that test fails.
 */
'use strict';

const YOUTUBE_ID = /^[\w-]{11}$/;
const PATH_FORMS = ['embed', 'shorts', 'live', 'v'];

/** Mirror of extractVideoKey in src/modules/genAI/utils/videoKey.ts. */
function extractVideoKey(url) {
  if (!url) return null;

  const raw = String(url).trim();
  if (!raw) return null;

  if (raw.startsWith('yt:') && YOUTUBE_ID.test(raw.slice(3))) return raw;
  if (YOUTUBE_ID.test(raw)) return `yt:${raw}`;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return segments[0] && YOUTUBE_ID.test(segments[0])
      ? `yt:${segments[0]}`
      : null;
  }

  if (
    host !== 'youtube.com' &&
    host !== 'm.youtube.com' &&
    host !== 'youtube-nocookie.com'
  ) {
    return null;
  }

  const queryId = parsed.searchParams.get('v');
  if (queryId && YOUTUBE_ID.test(queryId)) return `yt:${queryId}`;

  if (segments.length >= 2 && PATH_FORMS.includes(segments[0].toLowerCase())) {
    return YOUTUBE_ID.test(segments[1]) ? `yt:${segments[1]}` : null;
  }

  return null;
}

async function main() {
  require('dotenv').config();
  const {MongoClient} = require('mongodb');

  const APPLY = process.env.APPLY === '1';
  const DB_NAME = process.env.BACKFILL_DB || 'vibe';

  const uri = process.env.DB_URL;
  if (!uri) {
    throw new Error('DB_URL not set (run from backend/ so .env resolves)');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);
  const jobs = db.collection('genAI_jobs');

  const all = await jobs.find({}, {projection: {url: 1, videoKey: 1}}).toArray();
  console.log(
    `${APPLY ? 'APPLY' : 'DRY RUN'} — db=${DB_NAME}, ${all.length} job(s)\n`,
  );

  const stats = {total: all.length, alreadySet: 0, written: 0, unresolved: 0};
  const unresolvedUrls = [];

  for (const job of all) {
    const key = extractVideoKey(job.url);

    if (!key) {
      stats.unresolved++;
      unresolvedUrls.push({_id: job._id.toString(), url: job.url ?? null});
      console.log(`  ✗ ${job._id}: url not recognised (${job.url ?? 'none'})`);
      continue;
    }

    if (job.videoKey === key) {
      stats.alreadySet++;
      continue;
    }

    stats.written++;
    console.log(`  ✓ ${job._id}: ${key}`);
    if (APPLY) {
      await jobs.updateOne({_id: job._id}, {$set: {videoKey: key}});
    }
  }

  if (APPLY) {
    // Matches the index declared in GenAIRepository.init, so a fresh deploy and
    // a backfilled database end up in the same state.
    await jobs.createIndex({videoKey: 1, createdAt: -1});
    console.log('\nEnsured index {videoKey: 1, createdAt: -1}');
  }

  console.log('\n=== summary ===');
  console.log(JSON.stringify(stats, null, 2));
  if (unresolvedUrls.length) {
    console.log(
      '\nUnresolved (playlists and non-YouTube sources are expected here):',
    );
    console.log(JSON.stringify(unresolvedUrls, null, 2));
  }
  console.log(
    APPLY ? 'Wrote videoKey above.' : 'DRY RUN — re-run with APPLY=1 to persist.',
  );

  await client.close();
}

module.exports = {extractVideoKey};

// Only connect to a database when run directly; the parity test requires this
// file purely for the normaliser above.
if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
