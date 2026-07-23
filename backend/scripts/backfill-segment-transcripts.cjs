/*
 * Backfill precomputed per-segment lesson context for crowd-question screening.
 *
 * For each video segment that has crowd-question submissions, resolve its source
 * transcript and persist the segment-scoped text into the `segmentContext`
 * collection, which SegmentContextProvider (Layer 1) reads at screen time. This
 * exists because transcripts live only as whole-video JSON files in GCS with no
 * persisted segment link — too slow/unreliable to fetch inline per submission.
 *
 * Linkage (best-effort, logged when it fails):
 *   segment (videos._id) -> videos.details.URL -> genAI_jobs.url (latest job with
 *   a transcriptGeneration fileUrl) -> download GCS JSON {chunks:[{timestamp:[s,e],text}]}
 *   -> keep chunks overlapping the segment's [startTime,endTime] -> join text.
 *
 * Usage (from backend/, so .env DB_URL resolves):
 *   node scripts/backfill-segment-transcripts.js            # DRY RUN (no writes)
 *   APPLY=1 node scripts/backfill-segment-transcripts.js    # write segmentContext
 *   SEGMENTS=id1,id2 node scripts/backfill-segment-transcripts.js   # limit to segments
 *
 * Dry-run is the default; nothing is written unless APPLY=1.
 */
'use strict';

require('dotenv').config();
const {MongoClient, ObjectId} = require('mongodb');
const axios = require('axios');

const APPLY = process.env.APPLY === '1';
const DB_NAME = process.env.BACKFILL_DB || 'vibe';
const CONTEXT_CHAR_BUDGET = Number(process.env.SCREENING_CONTEXT_CHARS || '2000');

/** "HH:MM:SS" | "MM:SS" | number-ish -> seconds. */
function toSeconds(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

async function main() {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error('DB_URL not set (run from backend/ so .env resolves)');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);

  const videos = db.collection('videos');
  const jobs = db.collection('genAI_jobs');
  const studentQuestions = db.collection('studentSegmentQuestions');
  const segmentContext = db.collection('segmentContext');

  // Target segments: explicit list, else every segment that has a submission.
  let segmentIds;
  if (process.env.SEGMENTS) {
    segmentIds = process.env.SEGMENTS.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    const raw = await studentQuestions.distinct('segmentId');
    segmentIds = raw.map(x => (x && x.toString ? x.toString() : String(x)));
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — db=${DB_NAME}, ${segmentIds.length} candidate segment(s)\n`);

  const stats = {total: segmentIds.length, noVideo: 0, noUrl: 0, noJob: 0, noTranscript: 0, noChunks: 0, written: 0};
  const transcriptCache = new Map(); // fileUrl -> chunks[]

  for (const segId of segmentIds) {
    let video = null;
    try {
      video = await videos.findOne({_id: new ObjectId(segId)});
    } catch {
      /* non-ObjectId segmentId */
    }
    if (!video) {
      video = await videos.findOne({_id: segId});
    }
    if (!video) {
      stats.noVideo++;
      console.log(`  ✗ ${segId}: no video item`);
      continue;
    }

    const url = video.details && video.details.URL;
    if (!url) {
      stats.noUrl++;
      console.log(`  ✗ ${segId}: video has no details.URL`);
      continue;
    }

    // Latest genAI job for this URL that produced a transcript file.
    const jobList = await jobs.find({url}).sort({createdAt: -1}).toArray();
    let fileUrl = null;
    for (const job of jobList) {
      const gens = (job.taskData && job.taskData.transcriptGeneration) || job.transcriptGeneration || [];
      const arr = Array.isArray(gens) ? gens : [];
      const withUrl = arr.filter(g => g && g.fileUrl);
      if (withUrl.length) {
        fileUrl = withUrl[withUrl.length - 1].fileUrl;
        break;
      }
    }
    if (!jobList.length) {
      stats.noJob++;
      console.log(`  ✗ ${segId}: no genAI job for url ${url}`);
      continue;
    }
    if (!fileUrl) {
      stats.noTranscript++;
      console.log(`  ✗ ${segId}: job(s) present but no transcript fileUrl`);
      continue;
    }

    // Download + cache the transcript JSON.
    let chunks = transcriptCache.get(fileUrl);
    if (!chunks) {
      try {
        const res = await axios.get(fileUrl, {timeout: 20000});
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        chunks = Array.isArray(data && data.chunks) ? data.chunks : [];
        transcriptCache.set(fileUrl, chunks);
      } catch (e) {
        stats.noTranscript++;
        console.log(`  ✗ ${segId}: transcript download failed (${e.message})`);
        continue;
      }
    }

    // Slice to the segment's time window; fall back to the whole transcript.
    const segStart = toSeconds(video.details && video.details.startTime);
    const segEnd = toSeconds(video.details && video.details.endTime);
    let selected = chunks;
    if (segStart != null && segEnd != null && segEnd > segStart) {
      const sliced = chunks.filter(c => {
        const ts = c && c.timestamp;
        if (!Array.isArray(ts) || ts.length < 2) return false;
        const [cs, ce] = ts;
        return ce > segStart && cs < segEnd; // overlap
      });
      if (sliced.length) selected = sliced;
    }

    const text = selected
      .map(c => (c && typeof c.text === 'string' ? c.text.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .slice(0, CONTEXT_CHAR_BUDGET)
      .trim();

    if (!text) {
      stats.noChunks++;
      console.log(`  ✗ ${segId}: transcript had no usable text for this window`);
      continue;
    }

    stats.written++;
    console.log(`  ✓ ${segId}: ${text.length} chars (${selected.length} chunk(s))`);
    if (APPLY) {
      await segmentContext.updateOne(
        {segmentId: segId},
        {
          $set: {
            segmentId: segId,
            courseVersionId: video.courseVersionId ? video.courseVersionId.toString() : undefined,
            text,
            source: 'TRANSCRIPT',
            updatedAt: new Date(),
          },
        },
        {upsert: true},
      );
    }
  }

  console.log('\n=== summary ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log(APPLY ? 'Wrote segmentContext rows above.' : 'DRY RUN — re-run with APPLY=1 to persist.');
  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
