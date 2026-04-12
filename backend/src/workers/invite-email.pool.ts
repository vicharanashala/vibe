import {Worker} from 'worker_threads';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {chunkArray} from '#root/utils/chunkArray.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JobStatus {
  id: string;
  total: number;
  processed: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  logs: string[];
}

const jobs: Record<string, JobStatus> = {};

export const startInviteEmailProcessing = (
  inviteIds: string[],
  courseId: string,
  courseVersionId: string,
) => {
  if (!inviteIds?.length) return;

  const jobId = Date.now().toString();
  const total = inviteIds.length;

  const job: JobStatus = {
    id: jobId,
    total,
    processed: 0,
    status: 'running',
    startedAt: new Date(),
    logs: [`🚀 Invite Email Job ${jobId} started (${total} invites)`],
  };

  jobs[jobId] = job;

  const cpuCount = os.cpus().length;
  const MAX_WORKERS = Math.min(8, Math.max(2, Math.floor(cpuCount / 2)));

  const CHUNK_SIZE = Math.ceil(inviteIds.length / MAX_WORKERS);
  const chunks = chunkArray(inviteIds, CHUNK_SIZE);

  const workerFile = path.join(__dirname, 'invite-email.worker.js');

  job.logs.push(`⚙️ Using ${MAX_WORKERS} workers (chunk ~${CHUNK_SIZE})`);

  let completedWorkers = 0;
  let failedWorkers = 0;
  chunks.forEach((chunk, index) => {
    let worker:Worker;
    try {
      worker = new Worker(workerFile, {
        workerData: {
          inviteIds: chunk,
          courseId,
          courseVersionId,
          mongoUri: process.env.DB_URL!,
          dbName: process.env.DB_NAME!,
        },
      });
    } catch (err) {
      console.error('💥 Worker failed to start', err);
    }
    worker.on('error', err => {
      console.error('🔥 WORKER BOOT ERROR', err);
    });

    job.logs.push(`🧩 Worker ${index + 1} started (${chunk.length} invites)`);

    worker.on('message', msg => {
      if (msg?.processed) job.processed += msg.processed;
      // if (msg?.success) completedWorkers++;
    });

    worker.on('error', err => {
      failedWorkers++;
      job.logs.push(`❌ Worker ${index + 1} error: ${err.message}`);
    });

    worker.on('exit', code => {
      if (code == 0) {
        completedWorkers++
      }else{
        failedWorkers++;
        job.logs.push(`⚠️ Worker ${index + 1} exited with code ${code}`);
      }
      if (completedWorkers + failedWorkers === chunks.length) {
        job.finishedAt = new Date();
        job.status = failedWorkers === 0 ? 'completed' : 'failed';
        const summary =
          `🏁 FINAL — Invite job ${jobId} finished\n` +
          `   Workers: ${chunks.length}\n` +
          `   Processed: ${job.processed}/${job.total}\n` +
          `   Failed Workers: ${failedWorkers}\n` +
          `   Started: ${job.startedAt.toLocaleTimeString()}\n` +
          `   Ended: ${job.finishedAt.toLocaleTimeString()}`;
        job.logs.push(
          // `🏁 Job finished. Processed ${job.processed}/${job.total}. Failed: ${failedWorkers}`
          summary,
        );
        console.log(summary);
      }
    });
  });

  return jobId;
};

export const getInviteEmailJobs = () =>
  Object.values(jobs).map(({logs, ...rest}) => ({
    ...rest,
    logs: logs.slice(-10),
  }));

export const getInviteEmailJob = (jobId: string) => jobs[jobId];
