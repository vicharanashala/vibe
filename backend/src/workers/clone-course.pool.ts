import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkArray } from '#root/utils/chunkArray.js';
import type { Module } from '#root/modules/courses/classes/index.js';

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
    clonedModules?: Module[];
}

const jobs: Record<string, JobStatus> = {};

export const startCourseCloneProcessing = (
    modules: Module[],
    newVersionId: string,
    newCourseId: string,
): Promise<Module[]> => {
    return new Promise((resolve, reject) => {
        if (!modules?.length) {
            resolve([]);
            return;
        }

        const jobId = Date.now().toString();
        const total = modules.length;

        const job: JobStatus = {
            id: jobId,
            total,
            processed: 0,
            status: 'running',
            startedAt: new Date(),
            logs: [`Course Clone Job ${jobId} started (${total} modules)`],
            clonedModules: [],
        };

        jobs[jobId] = job;

        const cpuCount = os.cpus().length;
        const MAX_WORKERS = Math.min(4, Math.max(1, Math.floor(cpuCount / 2)));
        console.log("Max workers", MAX_WORKERS)
        const CHUNK_SIZE = Math.ceil(modules.length / MAX_WORKERS);
        const chunks = chunkArray(modules, CHUNK_SIZE);

        const workerFile = path.join(__dirname, 'clone-course.worker.js');

        job.logs.push(`Using ${chunks.length} workers (chunk ~${CHUNK_SIZE})`);

        let completedWorkers = 0;
        let failedWorkers = 0;
        const allClonedModules: (Module | null)[] = new Array(modules.length).fill(null);
        const moduleIndexMap = new Map<string, number>();

        modules.forEach((module, index) => {
            moduleIndexMap.set(module.moduleId.toString(), index);
        });

        chunks.forEach((chunk, index) => {
            let worker: Worker;
            try {
                worker = new Worker(workerFile, {
                    workerData: {
                        modules: chunk,
                        newVersionId,
                        newCourseId,
                        mongoUri: process.env.DB_URL!,
                        dbName: process.env.DB_NAME!,
                    },
                });
            } catch (err) {
                console.error('Worker failed to start', err);
                failedWorkers++;
                checkCompletion();
                return;
            }

            worker.on('error', err => {
                console.error('WORKER BOOT ERROR', err);
            });

            job.logs.push(`Worker ${index + 1} started (${chunk.length} modules)`);

            worker.on('message', msg => {
                if (msg?.clonedModules) {
                    msg.clonedModules.forEach((clonedModule: Module) => {
                        const originalIndex = moduleIndexMap.get(clonedModule.moduleId.toString());
                        if (originalIndex !== undefined) {
                            allClonedModules[originalIndex] = clonedModule;
                        }
                    });
                    job.processed += msg.clonedModules.length;
                }
            });

            worker.on('error', err => {
                failedWorkers++;
                job.logs.push(`Worker ${index + 1} error: ${err.message}`);
                checkCompletion();
            });

            worker.on('exit', code => {
                if (code === 0) {
                    completedWorkers++;
                } else {
                    failedWorkers++;
                    job.logs.push(`Worker ${index + 1} exited with code ${code}`);
                }
                checkCompletion();
            });
        });

        function checkCompletion() {
            if (completedWorkers + failedWorkers === chunks.length) {
                job.finishedAt = new Date();
                job.status = failedWorkers === 0 ? 'completed' : 'failed';
                job.clonedModules = allClonedModules;

                const durationMs = job.finishedAt.getTime() - job.startedAt.getTime();
                const summary =
                    `Clone job ${jobId} finished\n` +
                    `   Workers: ${chunks.length}\n` +
                    `   Processed: ${job.processed}/${job.total}\n` +
                    `   Failed Workers: ${failedWorkers}\n` +
                    `   Duration: ${durationMs}ms\n` +
                    `   Started: ${job.startedAt.toLocaleTimeString()}\n` +
                    `   Ended: ${job.finishedAt.toLocaleTimeString()}`;

                job.logs.push(summary);
                console.log(summary);

                if (failedWorkers === 0) {
                    const validModules = allClonedModules.filter((m): m is Module => m !== null);
                    resolve(validModules);
                } else {
                    reject(new Error(`Clone job failed: ${failedWorkers} workers failed`));
                }
            }
        }
    });
};

export const getCourseCloneJobs = () =>
    Object.values(jobs).map(({ logs, clonedModules, ...rest }) => ({
        ...rest,
        logs: logs.slice(-10),
    }));

export const getCourseCloneJob = (jobId: string) => jobs[jobId];
