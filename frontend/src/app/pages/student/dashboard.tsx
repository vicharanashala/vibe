import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";

// Import new components
import { StatCard } from "@/components/ui/StatCard";
import { AnnouncementBanner } from "@/components/ui/AnnouncementBanner";
import { CourseSection } from "@/components/course/CourseSection";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGreeting } from "@/utils/helpers";

export default function Page() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const userId = user?.userId;

  // Redirect to auth page if not logged in yet
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      console.log("User not authenticated or no userId found, redirecting to auth page");
      navigate({ to: '/auth' });
    }
  }, [isAuthenticated, userId, navigate]);

  // While we don't have a real userId, show loading/auth prompt
  if (!isAuthenticated || !userId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <EmptyState
          title={!isAuthenticated ? "Authentication Required" : "Loading..."}
          description={!isAuthenticated
            ? "Please log in to view your dashboard"
            : "Preparing your dashboard..."}
          actionText={!isAuthenticated ? "Go to Login" : undefined}
          onAction={!isAuthenticated ? () => navigate({ to: '/auth' }) : undefined}
        />
      </div>
    );
  }

  // Only once userId is truthy do we render the dashboard content
  return <DashboardContent userId={userId} />;
}

interface DashboardContentProps {
  userId: string;
}

function DashboardContent({ userId }: DashboardContentProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const studentName = user?.name || user?.firstName || 'Student';

  // Greeting state & updater
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Now safe to call the enrollments hook with a real userId
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError
  } = useUserEnrollments(userId, 1, 5, true);

  const enrollments = enrollmentsData?.enrollments || [];
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;
  const totalProgress = enrollments.length > 0
    ? Math.round(Math.random() * 100)
    : 0;

  return (
    <>
      {/* Greeting & Stats */}
      <div className="flex flex-col md:flex-row items-stretch mb-8 px-4 md:px-28 lg:px-16 xl:px-0">
        <div className="flex-1 flex flex-col justify-center bg-background rounded-lg p-6 mb-0">
          <h1 className="text-3xl font-bold mb-1">
            {greeting}, {studentName} 👋
          </h1>
          <p className="text-muted-foreground">
            Welcome to your learning dashboard, check your priority learning.
          </p>
        </div>
        <div className="ml-0 md:ml-8 flex flex-row gap-4 items-center">
          <StatCard icon="🏆" value={`${totalEnrollments}`} label="Enrolled Courses" />
          <StatCard icon="⏱️" value="2.5h" label="Study Time" />
          <StatCard icon="🎓" value={`${totalProgress}%`} label="Overall Progress" />
        </div>
      </div>

      {/* Announcement */}
      <AnnouncementBanner
        title="Achievement Unlocked!"
        description="Congratulations! You've earned the 'Quick Learner' badge by completing 5 lessons in a single day."
      />

      {/* Main content & sidebar */}
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
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
              onAction: () => navigate({ to: '/student/courses' })
            }}
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

        <DashboardSidebar enrollments={enrollments} />
      </div>
    </>
  );
}
