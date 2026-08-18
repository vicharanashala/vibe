import {useCourseStore} from '@/store/course-store';
import ReflectionsPanel from './components/ReflectionsPanel';
import CourseBackButton from './CourseBackButton';

/**
 * Instructor page for peer-reviewed reflections, scoped to the course version
 * currently selected in the course store — the same convention the student
 * questions and enrolments pages follow.
 */
export default function ReflectionReview() {
  const {currentCourse} = useCourseStore();
  const courseId = currentCourse?.courseId;
  const courseVersionId = currentCourse?.versionId;

  return (
    <div className="space-y-4 p-4">
      <CourseBackButton />

      <div>
        <h1 className="text-xl font-semibold">Reflections</h1>
        <p className="text-sm text-muted-foreground">
          What students wrote after each section, and how their peers scored it.
        </p>
      </div>

      {!courseId || !courseVersionId ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Select a course version to view its reflections.
        </p>
      ) : (
        <ReflectionsPanel
          courseId={courseId}
          courseVersionId={courseVersionId}
        />
      )}
    </div>
  );
}
