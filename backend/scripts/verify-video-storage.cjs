#!/usr/bin/env node
/**
 * Diagnostics for the uploaded-video pipeline (media module).
 *
 * Answers, with facts instead of assumptions:
 *   - which credential is active, and whether it can even reach these buckets
 *   - whether this credential can sign V4 URLs at all
 *   - what the transcoder actually names its output (the layout nobody documented)
 *
 * Read-only by default:
 *   node scripts/verify-video-storage.cjs
 *
 * Full end-to-end — uploads a real file and watches for the HLS output:
 *   node scripts/verify-video-storage.cjs --upload ./sample.mp4
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS (or ADC) for a principal with
 * objectAdmin on the raw bucket and objectViewer on the processed bucket.
 */

const fs = require('fs');
const path = require('path');

// Read .env the way the server does, so this reports on the same configuration
// the backend actually runs with rather than a hand-passed environment.
try {
  require('dotenv').config();
} catch {
  // dotenv absent: fall back to whatever is already in the environment.
}

// Defaults intentionally mirror src/config/storage.ts. Duplicated because this
// is a plain .cjs diagnostic that cannot import the compiled TS config.
const UPLOAD_BUCKET =
  process.env.GOOGLE_VIDEO_UPLOAD_BUCKET ||
  'hls-streaming-gcp-raw-files-vibe-5b35a';
const STREAM_BUCKET =
  process.env.GOOGLE_VIDEO_STREAM_BUCKET ||
  'hls-streaming-gcp-processed-files-vibe-5b35a';

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const uploadIndex = args.indexOf('--upload');
const uploadPath = uploadIndex !== -1 ? args[uploadIndex + 1] : null;

const results = [];
function record(name, ok, detail) {
  results.push({name, ok, detail});
  const mark = ok === null ? '•' : ok ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const {Storage} = require('@google-cloud/storage');

  console.log('\n── Credentials ─────────────────────────────────────────────');

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentialProject = null;
  let credentialEmail = null;

  if (credPath && fs.existsSync(credPath)) {
    const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    credentialProject = cred.project_id;
    credentialEmail = cred.client_email;
    record('GOOGLE_APPLICATION_CREDENTIALS', true, credPath);
    record('service account', true, credentialEmail);
    record('credential project', true, credentialProject);
    record(
      'can sign V4 URLs offline',
      Boolean(cred.private_key),
      cred.private_key
        ? 'private key present'
        : 'NO private key — getSignedUrl will need the IAM SignBlob API',
    );
  } else {
    record(
      'GOOGLE_APPLICATION_CREDENTIALS',
      false,
      credPath
        ? `set but file missing: ${credPath}`
        : 'not set — falling back to ADC',
    );
    record(
      'can sign V4 URLs offline',
      false,
      'user ADC has no private key; getSignedUrl throws without a service account',
    );
  }

  // The bucket names encode their project. A credential from a different project
  // still *signs* successfully (V4 signing is offline) but every resulting URL
  // 403s — a failure that looks like working code until the first real PUT.
  const bucketProjectHint = STREAM_BUCKET.match(/-([a-z0-9]+)$/)?.[1];
  if (credentialProject && bucketProjectHint) {
    const looksSameProject = credentialProject.includes(bucketProjectHint);
    record(
      'credential project matches buckets',
      looksSameProject,
      looksSameProject
        ? undefined
        : `credential is "${credentialProject}" but buckets look like project ` +
          `"…${bucketProjectHint}". Signing will succeed and then 403 on use.`,
    );
  }

  const storage = new Storage(
    process.env.GCLOUD_PROJECT
      ? {projectId: process.env.GCLOUD_PROJECT}
      : undefined,
  );

  console.log('\n── Bucket access ───────────────────────────────────────────');
  // The upload bucket is checked with testPermissions, not by listing: the
  // correct grant here is write-only (objectCreator), so a listing failure would
  // report a properly least-privileged service account as broken.
  await probeUploadPermissions(storage, UPLOAD_BUCKET);
  await probeBucket(storage, STREAM_BUCKET, 'processed/stream bucket');

  console.log('\n── Signing ─────────────────────────────────────────────────');
  await probeSigning(storage);

  if (uploadPath) {
    await runEndToEnd(storage, uploadPath);
  } else {
    console.log('\n── Output layout ───────────────────────────────────────────');
    console.log(
      '  • skipped. Re-run with --upload <file.mp4> to upload a real video and\n' +
        '    discover what the transcoder names its output.',
    );
    await listExistingLayout(storage);
  }

  summarize();
}

/**
 * The upload bucket only needs `storage.objects.create`. Ask GCS directly which
 * permissions we hold rather than inferring from a failed listing.
 */
async function probeUploadPermissions(storage, bucketName) {
  try {
    const [granted] = await storage
      .bucket(bucketName)
      .iam.testPermissions(['storage.objects.create']);
    const canCreate = Boolean(granted['storage.objects.create']);
    record(
      'raw/upload bucket writable',
      canCreate,
      canCreate
        ? `${bucketName} (objects.create granted)`
        : `${bucketName}: storage.objects.create denied — the service account ` +
          'cannot upload. Grant it objectCreator (or objectAdmin).',
    );
  } catch (error) {
    record('raw/upload bucket writable', false, `${bucketName}: ${error.message}`);
  }
}

async function probeBucket(storage, bucketName, label) {
  try {
    const [files] = await storage
      .bucket(bucketName)
      .getFiles({maxResults: 1, autoPaginate: false});
    record(`${label} readable`, true, `${bucketName} (${files.length} sampled)`);
  } catch (error) {
    record(`${label} readable`, false, `${bucketName}: ${error.message}`);
  }
}

async function probeSigning(storage) {
  try {
    const [url] = await storage
      .bucket(UPLOAD_BUCKET)
      .file('diagnostics/connectivity-probe.mp4')
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 10 * 60 * 1000,
        contentType: 'video/mp4',
      });
    record('sign upload URL', true, `${url.slice(0, 72)}…`);
  } catch (error) {
    record('sign upload URL', false, error.message);
  }

  try {
    await storage
      .bucket(STREAM_BUCKET)
      .file('diagnostics/probe.m3u8')
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000,
      });
    record('sign playback URL', true);
  } catch (error) {
    record('sign playback URL', false, error.message);
  }
}

/** Show the shape of any output already sitting in the processed bucket. */
async function listExistingLayout(storage) {
  try {
    const [files] = await storage
      .bucket(STREAM_BUCKET)
      .getFiles({maxResults: 40, autoPaginate: false});
    if (files.length === 0) {
      record('existing output objects', null, 'processed bucket is empty');
      return;
    }
    console.log(`\n  Sample of existing objects in ${STREAM_BUCKET}:`);
    for (const file of files) console.log(`    ${file.name}`);
    const playlists = files.filter(f => f.name.endsWith('.m3u8'));
    record(
      'playlists found',
      playlists.length > 0,
      playlists.length ? playlists.map(p => p.name).join(', ') : 'none',
    );
  } catch (error) {
    record('existing output objects', false, error.message);
  }
}

/**
 * Upload a real file and watch the processed bucket until a playlist appears.
 * This is what actually settles the output-layout question.
 */
async function runEndToEnd(storage, filePath) {
  console.log('\n── End-to-end ──────────────────────────────────────────────');

  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    record('source file', false, `not found: ${absolute}`);
    summarize();
    return;
  }

  const assetId = `diag-${Date.now()}`;
  const objectKey = `uploads/${assetId}/source${path.extname(absolute).toLowerCase()}`;

  try {
    await storage
      .bucket(UPLOAD_BUCKET)
      .upload(absolute, {destination: objectKey, contentType: 'video/mp4'});
    record('uploaded to raw bucket', true, objectKey);
  } catch (error) {
    record('uploaded to raw bucket', false, error.message);
    summarize();
    return;
  }

  console.log(
    `\n  Watching ${STREAM_BUCKET} for output (up to ${
      POLL_TIMEOUT_MS / 60000
    } min)…`,
  );

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const seen = new Set();

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    let files = [];
    try {
      [files] = await storage.bucket(STREAM_BUCKET).getFiles();
    } catch (error) {
      console.log(`    (list failed: ${error.message})`);
      continue;
    }

    // Only objects carrying this run's id can be ours.
    const mine = files.filter(f => f.name.includes(assetId));
    for (const file of mine) {
      if (!seen.has(file.name)) {
        seen.add(file.name);
        console.log(`    + ${file.name}`);
      }
    }

    const playlist = [...seen].find(name => name.endsWith('.m3u8'));
    if (playlist) {
      record('transcoded output appeared', true, playlist);
      console.log(
        '\n  ▶ THIS IS THE ANSWER to the output-layout question. Feed this path\n' +
          '    shape into videoStoragePaths.candidateStreamPrefixes and the probe\n' +
          '    can collapse to a single deterministic prefix.',
      );
      summarize();
      return;
    }
  }

  record(
    'transcoded output appeared',
    false,
    seen.size
      ? `objects appeared but no .m3u8 within the timeout: ${[...seen].join(', ')}`
      : 'nothing appeared — check the Cloud Function and Transcoder logs',
  );
  summarize();
}

function summarize() {
  const failed = results.filter(r => r.ok === false);
  console.log('\n── Summary ─────────────────────────────────────────────────');
  if (failed.length === 0) {
    console.log('  All checks passed.\n');
    return;
  }
  console.log(`  ${failed.length} check(s) failed:\n`);
  for (const failure of failed) {
    console.log(`  ✗ ${failure.name}`);
    if (failure.detail) console.log(`      ${failure.detail}`);
  }
  console.log(
    '\n  Most likely fix: a service account key in the SAME project as the\n' +
      '  buckets, with objectAdmin on the raw bucket and objectViewer on the\n' +
      '  processed bucket, exported to GOOGLE_APPLICATION_CREDENTIALS.\n',
  );
  process.exitCode = 1;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  console.error('\nDiagnostics crashed:', error);
  process.exitCode = 1;
});
