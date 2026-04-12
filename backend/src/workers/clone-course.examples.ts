/**
 * Example usage of the Course Cloning Worker Implementation
 * 
 * This file demonstrates how the worker threads are used
 * and how to monitor cloning jobs.
 */

import { CourseVersionService } from '#root/modules/courses/services/CourseVersionService.js';
import { getCourseCloneJobs, getCourseCloneJob } from '#root/workers/clone-course.pool.js';

/**
 * Example 1: Clone a course (automatic worker selection)
 * 
 * The service automatically decides whether to use workers based on module count
 */
async function exampleCloneCourse(
    courseVersionService: CourseVersionService,
    courseId: string,
    versionId: string
) {
    console.log('Starting course clone...');

    // This will automatically use:
    // - Worker threads if modules >= 3
    // - Traditional method if modules < 3
    const success = await courseVersionService.copyCourseVersion(
        courseId,
        versionId
    );

    if (success) {
        console.log('✅ Course cloned successfully!');
    } else {
        console.error('❌ Course clone failed');
    }

    return success;
}

/**
 * Example 2: Monitor cloning jobs
 * 
 * View all active and completed cloning jobs
 */
function exampleMonitorJobs() {
    // Get all jobs (recent 10 logs per job)
    const allJobs = getCourseCloneJobs();

    console.log('📊 Course Clone Jobs:');
    allJobs.forEach(job => {
        console.log(`
Job ID: ${job.id}
Status: ${job.status}
Progress: ${job.processed}/${job.total} modules
Started: ${job.startedAt}
${job.finishedAt ? `Finished: ${job.finishedAt}` : 'Still running...'}
    `);
    });
}

/**
 * Example 3: Get specific job details
 */
function exampleGetJobDetails(jobId: string) {
    const job = getCourseCloneJob(jobId);

    if (!job) {
        console.log(`Job ${jobId} not found`);
        return;
    }

    console.log('📋 Job Details:');
    console.log(`Status: ${job.status}`);
    console.log(`Total Modules: ${job.total}`);
    console.log(`Processed: ${job.processed}`);
    console.log('Recent Logs:');
    job.logs.forEach(log => console.log(`  ${log}`));
}

/**
 * Example 4: Expected behavior for different course sizes
 */
function exampleExpectedBehavior() {
    console.log(`
Expected Behavior:

Small Course (1-2 modules):
  ✅ Uses traditional synchronous cloning
  ✅ Fast and efficient for small data
  ✅ No worker overhead

Medium Course (3-9 modules):
  ✅ Uses 2-3 worker threads
  ✅ Parallel processing speeds up cloning
  ✅ Good balance of speed and resource usage

Large Course (10+ modules):
  ✅ Uses maximum 4 worker threads
  ✅ Optimal parallelization
  ✅ Significant performance improvement
  
Console Output Examples:
  - "📝 Using synchronous cloning for small course"
  - "🚀 Using worker threads for course cloning"
  - "🔄 Clone worker started for 5 modules"
  - "🏁 Clone worker finished → 5/5 modules"
  `);
}

/**
 * Example 5: Error handling
 */
async function exampleErrorHandling(
    courseVersionService: CourseVersionService,
    courseId: string,
    versionId: string
) {
    try {
        const success = await courseVersionService.copyCourseVersion(
            courseId,
            versionId
        );

        if (!success) {
            // Clone failed but didn't throw
            console.error('Clone returned false - check logs for details');
            // Possible reasons:
            // - Course not found
            // - Version not found
            // - Worker failures
        }
    } catch (error) {
        // Exception thrown
        console.error('Clone threw an error:', error);
        // Possible reasons:
        // - Invalid courseId/versionId
        // - Database connection issues
        // - All workers failed
    }
}

// Export examples for testing
export {
    exampleCloneCourse,
    exampleMonitorJobs,
    exampleGetJobDetails,
    exampleExpectedBehavior,
    exampleErrorHandling,
};
