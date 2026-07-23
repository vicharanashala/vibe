import { createFileRoute } from '@tanstack/react-router';
import AIVivaChat from '@/components/learn/AIVivaChat';
import { DEMO_COURSE, ALL_ITEMS } from './demoCourseData';

export const Route = createFileRoute('/student/course-viva')({
  component: CourseViva,
});

function CourseViva() {
  // For this preview, we'll use the demo course data.
  // In a real implementation, you would fetch this based on the user's enrollment.
  const courseName = DEMO_COURSE.name;
  const courseItemIds = ALL_ITEMS.map(item => item.id);

  // The `projects` prop is optional, so we can omit it for a basic preview.

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted p-4 sm:p-8">
      <div className="w-full h-full max-w-3xl max-h-[720px] mx-auto">
        <AIVivaChat
          courseName={courseName}
          courseItemIds={courseItemIds}
          // You can add mock project data here if you want to test that functionality
          projects={[]}
          onComplete={(grade) => {
            console.log(`Viva completed with grade: ${grade}`);
            // Here you could navigate away or show a completion summary
          }}
        />
      </div>
    </div>
  );
}

export default CourseViva;