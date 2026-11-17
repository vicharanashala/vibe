# Course analytics projector

The Studio course Overview reads precomputed analytics (`ca_*` collections)
built by the analytics projector (`modules/analytics`). The projector only
**reads** the learning records (enrollment, progress, watchTime, quiz results,
anomaly_records, studyViews, user_activity_events) and only **writes** `ca_*`.

## Modes

| Command | What it does | When |
|---|---|---|
| `node build/jobs/analyticsProjector.js refresh` | Incremental: recomputes only students with new records since the last run (a version never built is built in full) | every 5 minutes |
| `node build/jobs/analyticsProjector.js rebuild` | Full rebuild of every version with active students; corrects any drift | nightly, 02:30 IST |
| `node build/jobs/analyticsProjector.js backfill` | Same as `rebuild`; run once after the first deploy | once |

The process boots only the database and the analytics module (no HTTP
server, no cron) and exits non-zero if any course version failed. It needs
the same environment as the backend (DB_URL, DB_NAME, Firebase settings).

## Production: Cloud Run Job + Cloud Scheduler

The serving service runs with CPU throttling and 512 MiB, so the projector
runs as a separate Cloud Run Job on the same image:

```sh
# 1. The job (same image, env and secrets as vibe-backend-production)
gcloud run jobs create vibe-analytics-projector \
  --project vibe-5b35a --region asia-south1 \
  --image <backend image> \
  --command node --args build/jobs/analyticsProjector.js,refresh \
  --memory 2Gi --cpu 1 --max-retries 0 --task-timeout 15m \
  --set-env-vars NODE_ENV=production,DB_NAME=<db name> \
  --set-secrets <same secrets as the backend service>

# 2. Run the backfill once, then check one course against direct counts
gcloud run jobs execute vibe-analytics-projector --region asia-south1 \
  --project vibe-5b35a --args build/jobs/analyticsProjector.js,backfill --wait

# 3. Schedules (Cloud Scheduler → Cloud Run Jobs API, run as a service
#    account with roles/run.invoker on the job)
URI=https://run.googleapis.com/v2/projects/vibe-5b35a/locations/asia-south1/jobs/vibe-analytics-projector:run
gcloud scheduler jobs create http analytics-refresh --location asia-south1 \
  --schedule '*/5 * * * *' --time-zone Asia/Kolkata --http-method POST --uri "$URI" \
  --message-body '{"overrides":{"containerOverrides":[{"args":["build/jobs/analyticsProjector.js","refresh"]}]}}' \
  --oauth-service-account-email <scheduler SA>
gcloud scheduler jobs create http analytics-rebuild --location asia-south1 \
  --schedule '30 2 * * *' --time-zone Asia/Kolkata --http-method POST --uri "$URI" \
  --message-body '{"overrides":{"containerOverrides":[{"args":["build/jobs/analyticsProjector.js","rebuild"]}]}}' \
  --oauth-service-account-email <scheduler SA>
```

When the backend image is redeployed, point the job at the new image too
(`gcloud run jobs update vibe-analytics-projector --image <new image>`).

## Fallback: in-process cron

`ENABLE_ANALYTICS_PROJECTOR_JOB` turns on `bootstrap/jobs/analyticsProjector.ts`
(refresh every 5 minutes, rebuild at 02:30 IST) inside the backend process.
Default: **off** in production and staging, **on** elsewhere. Only one
refresher runs per course version at a time (lease in `ca_state`), so the
cron and the Cloud Run Job can safely overlap.

## On demand

`POST /api/analytics/courses/:courseId/versions/:versionId/rebuild` (admins
only) rebuilds one version in the background; the overview's `updatedAt`
changes when it finishes.

## Rollback

Pause the two scheduler jobs. The Overview keeps showing the last figures
(or "being prepared" for courses never built). The `ca_*` collections can be
dropped safely: nothing else reads them.
