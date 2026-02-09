import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments, useWatchtimeTotal } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";

// Import new components
import { StatCard } from "@/components/ui/StatCard";
import { CourseSection } from "@/components/course/CourseSection";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGreeting } from "@/utils/helpers";
import type { CoursePctCompletion } from '@/types/course.types';
import { stopAllStreams } from "@/lib/MediaRegistry";

export default function Page() {
  useEffect(() => {
    setTimeout(stopAllStreams, 1000);
  }, []);
  const { isAuthenticated, isAuthReady } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      console.log("User not authenticated, redirecting to auth page");
      navigate({ to: '/auth' });
    }
  }, [isAuthenticated, isAuthReady, navigate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-md">
          <EmptyState
            title="Loading..."
            description="Preparing your dashboard..."
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-md">
          <EmptyState
            title="Authentication Required"
            description="Please log in to view your dashboard"
            actionText="Go to Login"
            onAction={() => navigate({ to: '/auth' })}
          />
        </div>
      </div>
    );
  }
  return <DashboardContent />;
}


function DashboardContent() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const studentName = user?.name || 'Student';

  // Greeting state & updater
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);
  // Only fetch enrollments if user is authenticated (i.e., token is present)
  const { token } = useAuthStore();
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments
  } = useUserEnrollments(1, 5, !!token);



  const enrollments = enrollmentsData?.enrollments || [];
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;
  const { data: watchtimeData } = useWatchtimeTotal();
  
  // Check if student is already registered to Gurusetu course
  const gurusetuCourseId = "6981df886e100cfe04f9c4ad";
  const isRegisteredToGurusetu = enrollments.some(enrollment => {
    const courseId = enrollment.course?._id;
    // Handle MongoDB ObjectId conversion
    let courseIdStr: string | undefined = undefined;
    
    if (courseId?.type === 'Buffer') {
      // Convert Buffer to hex string
      courseIdStr = Buffer.from(courseId.data).toString('hex');
    } else if (courseId && typeof courseId === 'object') {
      // Handle ObjectId object - try different methods
      courseIdStr = courseId._id || courseId.id || courseId.toString() || JSON.stringify(courseId);
    }
    return enrollment.courseId === gurusetuCourseId || courseIdStr === gurusetuCourseId ;
  });
  
  // const filteredEnrollement = enrollments.filter(enrollment=>enrollment.role == "STUDENT");
  const [completion, setCompletion] = useState<CoursePctCompletion[]>([]);
  const totalProgress = useMemo(() => {
    const completed = completion.reduce((a, c) => a + (c.completedItems || 0), 0);
    const total = completion.reduce((a, c) => a + (c.totalItems || 0), 0);
    return total ? Math.round((completed / total) * 100) : 0;
  }, [completion]);

  return (
    <>
      {/* Greeting and Stat Cards in two separate flex boxes */}
      <div className="flex flex-col lg:flex-row justify-between items-start mb-8 px-0 sm:px-6 lg:px-8 xl:px-0 gap-6 transition-all duration-300">
        {/* Left: Greeting Box */}
        <div className="flex-1 bg-background rounded-lg lg:px-6 py-6 px-0">
          <h1 className="text-3xl font-bold mb-1">
            {greeting}, {studentName} 👋
          </h1>
          <p className="text-muted-foreground">
            Welcome to your learning dashboard, check your priority learning.
          </p>
        </div>
        {/* Right: Stat Cards */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full sm:w-auto">
          <StatCard
            icon="🏆"
            value={enrollmentsLoading ? "—" : `${totalEnrollments}`}
            label="Enrolled Courses"
          />
          <StatCard icon="🎓" value={`${totalProgress}%`} label="Completion Percentage" />
        </div>
      </div>
      {/* Announcement Banner */}
      {/* <div className="mb-2 px-0 sm:px-6 lg:px-8 xl:px-0 transition-all duration-300">
        {totalProgress > 0 && (
          <AnnouncementBanner
            title="Achievement Unlocked!"
            description="Congratulations! You've earned the 'Quick Learner' badge by completing 5 lessons in a single day."
          />
        )}
      </div> */}
      {/* Main content and sidebar */}
     <div className="mb-6 px-0 sm:px-6 lg:px-8 xl:px-0">
 {!isRegisteredToGurusetu && <div className="relative overflow-hidden rounded-xl">
    
    {/* Glow effect */}
    <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 opacity-30 blur-lg animate-pulse" />

    <a
      href="https://vibe.vicharanashala.ai/student/course-registration/6981df886e100cfe04f9c4ae"
      target="_blank"
      className="relative flex items-center justify-between gap-3 rounded-xl 
  bg-amber-100 dark:bg-[#4b341e4b] 
  border border-amber-300 dark:border-amber-600
  px-5 py-4 font-semibold
  text-lg sm:text-xl lg:text-2xl
  text-amber-900 dark:text-amber-200
  transition-all duration-300
  hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/30
  group"
    >
      <span className="flex items-center gap-3 text-base text-lg">
        🎓 
        <span>
          Join the <span className="font-bold underline decoration-amber-400">GURUSETU PILOT</span> now
        </span>
      </span>

      <svg
        className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  </div>}
</div>

      <div className="container mx-auto px-0 sm:px-6 lg:px-8 xl:px-0 py-6 flex flex-col lg:flex-row gap-6 transition-all duration-300">
        <main className="flex-1">
          <CourseSection
            title="In progress learning content"
            enrollments={enrollments}
            isLoading={enrollmentsLoading}
            error={enrollmentsError}
            totalEnrollments={totalEnrollments}
            showViewAll
            onViewAll={() => navigate({ to: '/student/courses' })}
            onRetry={() => window.location.reload()}
            variant="dashboard"
            emptyStateConfig={{
              title: "No courses enrolled yet",
              description: "Start your learning journey by enrolling in a course",
              actionText: "Browse Courses",
              onAction: () => navigate({ to: '/student/courses' }),
            }}
            completion={completion}
            setCompletion={setCompletion}
            className="mb-8"
          />
          <CourseSection
            title="Recommended for you"
            enrollments={[]}
            isLoading={false}
            showViewAll
            onViewAll={() => navigate({ to: '/student/courses' })}
            variant="dashboard"
            emptyStateConfig={{
              title: "Discover new courses",
              description: "Explore our course catalog to find your next learning adventure",
              actionText: "Browse All Courses",
              onAction: () => navigate({ to: '/student/courses' })
            }}
          />
        </main>
        <aside className="w-full lg:w-80">
          <div className="sticky top-6">
            <DashboardSidebar enrollments={enrollments} />
          </div>
        </aside>
      </div>
    </>
  );
}
