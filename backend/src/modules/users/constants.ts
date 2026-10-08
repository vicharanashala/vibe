// Courses that use the Guru Setu progress override: completion is measured
// as "feedback forms submitted / feedback forms in the version", ignoring
// every other item type (videos included), instead of the platform's normal
// all-item-types completion formula. See ProgressService.calculateGuruSetuProgress
// for the actual calculation -- this list only controls which courses route
// into it. Add a course here (and nowhere else) to put it on the same
// feedback-only formula as the others.
export const GURU_SETU_PROGRESS_COURSES: ReadonlyArray<{
  courseId: string;
  versionId: string;
}> = [
  {courseId: '6981df886e100cfe04f9c4ad', versionId: '6981df886e100cfe04f9c4ae'}, // Gurusetu Pilot (FDP for Faculty)
  {courseId: '6a9a7eb5de600629c9fb9405', versionId: '6a9a7eb5de600629c9fb9406'}, // GuruSetu Psychological Literacy Special Pilot
];

export function isGuruSetuProgressCourse(
  courseId?: string | null,
  versionId?: string | null,
): boolean {
  const courseIdStr = courseId?.toString();
  const versionIdStr = versionId?.toString();
  return GURU_SETU_PROGRESS_COURSES.some(
    c => c.courseId === courseIdStr && c.versionId === versionIdStr,
  );
}
