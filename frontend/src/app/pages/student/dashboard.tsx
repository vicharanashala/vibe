import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments, useWatchtimeTotal, usePublicCourses, useUserEnrollmentStats, useCheckTimeSlotAccessOnDemand } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";

// Import components
import { CourseSection } from "@/components/course/CourseSection";
import { LearningInsights } from "@/components/dashboard/LearningInsights";
// import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"; // Hidden: Learning Checklist sidebar (commented out, not removed)
import { EmptyState } from "@/components/ui/EmptyState";
import { getGreeting, bufferToHex } from "@/utils/helpers";
import type { CourseCardProps } from '@/types/course.types';
import { stopAllStreams } from "@/lib/MediaRegistry";
import { cn } from "@/utils/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCard } from "@/components/course/CourseCard";
import { CourseListCard } from "@/components/course/CourseListCard";
import { FollowUpInvitesBanner } from "@/components/course/FollowUpInvitesBanner";
import { NewAnnouncementsPopup } from "@/components/announcements/NewAnnouncementsPopup";
import { LayoutGrid, List, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Cards / List view switcher. Extracted so the three course tabs share one
 * implementation. Behaviour (and the persisted `viewMode`) is unchanged — this
 * only renders the toggle and calls back into the parent's `setViewMode`.
 */
function ViewSwitcher({ viewMode, setViewMode }: { viewMode: 'grid' | 'list'; setViewMode: (mode: 'grid' | 'list') => void }) {
  const baseBtn = "h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-300";
  const active = "bg-white text-foreground shadow-sm dark:bg-white/10 dark:text-white";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center gap-1 rounded-xl border border-neutral-200/70 bg-neutral-100/80 p-1 dark:border-white/[0.07] dark:bg-white/[0.04]">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Card view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={cn(baseBtn, viewMode === 'grid' ? active : inactive)}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Card view</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={cn(baseBtn, viewMode === 'list' ? active : inactive)}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>List view</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

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
  const { setCurrentCourse } = useCourseStore();
  const { check: checkTimeSlotAccess } = useCheckTimeSlotAccessOnDemand();
  const studentName = user?.name || 'Student';

  // Resume a specific course from the "next best action" CTA. Mirrors the card's
  // Continue flow (time-slot gate at entry; backend getItem is the safety net).
  const handleResume = async (enrollment: any) => {
    const courseId = bufferToHex(enrollment.courseId as string);
    const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
    const access = await checkTimeSlotAccess(courseId, versionId);
    if (!access.canAccess) {
      toast.error(access.message || "You can only access this course during your booked time slot.");
      return;
    }
    setCurrentCourse({
      courseId, versionId, moduleId: null, sectionId: null, itemId: null, watchItemId: null,
      cohortName: enrollment.cohortName || null, cohortId: enrollment.cohortId || null,
    });
    navigate({ to: "/student/learn" });
  };

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

  // Fetch more enrollments to properly populate tabs
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
  } = useUserEnrollments(1, 100, !!token); // Fetching 100 to get a good list for client-side filtering safely for now

  // Cast to CourseCardProps['enrollment'][] to satisfy type checker if needed,
  // but simpler to let TS infer from usage if types match.
  // Explicitly casting here to be safe given previous type errors.
  const enrollments = (enrollmentsData?.enrollments || []) as unknown as CourseCardProps['enrollment'][];

  const {
    data: publicCoursesData,
    isLoading: publicCoursesLoading
  } = usePublicCourses(1, 5, !!token);

  // Keep the watch-time query warm (preserves original prefetch behaviour); not displayed.
  useWatchtimeTotal();
  const { data: statsData, isLoading: statsLoading } = useUserEnrollmentStats(!!token);


   // Calculate distinct lists for tabs
  const activeEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => (enrollment.percentCompleted ?? 0) !== 100);
  }, [enrollments]);

  const completedEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => (enrollment.percentCompleted ?? 0) === 100);
  }, [enrollments]);

  // Tab State
  const [activeTab, setActiveTab] = useState("available");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);

  // View Mode State (Persisted)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('student_dashboard_view_mode');
      return (saved === 'list' ? 'list' : 'grid') as 'grid' | 'list';
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('student_dashboard_view_mode', viewMode);
  }, [viewMode]);

  // Set default tab based on enrollments once loaded
  useEffect(() => {
    if (!enrollmentsLoading && !hasSetInitialTab) {
      if (activeEnrollments.length > 0) {
        setActiveTab("enrolled");
      } else {
        setActiveTab("available");
      }
      setHasSetInitialTab(true);
    }
  }, [enrollmentsLoading, activeEnrollments.length, hasSetInitialTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <>
      {/* Auto-popup any announcements the student hasn't seen yet */}
      <NewAnnouncementsPopup />
      <div className="w-full">
        <div className="flex flex-col gap-6 lg:flex-row">
          <main className="w-full min-w-0 flex-1 space-y-6">
            {/* Greeting */}
            <section>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {greeting}, {studentName} 👋
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Welcome back — here's your progress at a glance.
              </p>
            </section>

            {/* Exclusive follow-up course invites unlocked by completing a course */}
            <FollowUpInvitesBanner />

            {/* Personalized "next best action" + at-a-glance insights, derived
                from data already fetched above (read-only). */}
            <LearningInsights
              activeEnrollments={activeEnrollments}
              isLoading={statsLoading || enrollmentsLoading}
              onBrowse={() => navigate({ to: '/student/courses' })}
              onResume={handleResume}
            />

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-2">
              <div className="flex items-center justify-between gap-3">
              <TabsList className="w-full md:w-fit flex h-auto p-1 bg-neutral-100/80 dark:bg-white/[0.04] rounded-xl border border-neutral-200/70 dark:border-white/[0.07] overflow-x-auto scrollbar-hide">
                <TabsTrigger
                  value="available"
                  className="rounded-lg px-3 py-1.5 md:px-4 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Available
                  {(publicCoursesData?.totalDocuments || 0) > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-md bg-primary/10 text-primary border border-primary/20">
                      {publicCoursesData?.totalDocuments}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="enrolled"
                  className="rounded-lg px-3 py-1.5 md:px-4 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Enrolled
                  {activeEnrollments.length > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-md bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                      {activeEnrollments.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="rounded-lg px-3 py-1.5 md:px-4 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Completed
                  {completedEnrollments.length > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-md bg-green-100 text-green-600 border border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20">
                      {completedEnrollments.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="About these tabs">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {activeTab === 'available'
                          ? 'Recommended courses to start next'
                          : activeTab === 'enrolled'
                            ? "Courses you're actively learning"
                            : 'Courses you have finished'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
              </div>
              </div>

              <TabsContent value="available" className="mt-2 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                <CourseSection
                  title=""
                  viewMode={viewMode}
                  enrollments={publicCoursesData?.courses?.map((course: any) => ({
                    courseId: course.courseId,
                    courseVersionId: course.courseVersionId,
                    course: {
                      name: course.courseName,
                      description: course.courseDescription,
                      instructors: course.instructors
                    },
                    cohortId: course.cohortId,
                    cohortName: course.cohortName,
                  })) || []}
                  isLoading={publicCoursesLoading}
                  showViewAll
                  onViewAll={() => navigate({ to: '/student/courses' })}
                  variant="dashboard"
                  cardVariant="available"
                  emptyStateConfig={{
                    title: "Discover new courses",
                    description: "Explore our course catalog to find your next learning adventure",
                    actionText: "Browse All Courses",
                    onAction: () => navigate({ to: '/student/courses' })
                  }}
                />
              </TabsContent>

              <TabsContent value="enrolled" className="mt-2 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                <div className="space-y-4">
                  {enrollmentsLoading ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"
                    )}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={cn(
                          "w-full bg-muted animate-pulse",
                          viewMode === 'grid' ? "h-[400px] rounded-[24px]" : "h-32 rounded-2xl"
                        )} />
                      ))}
                    </div>
                  ) : activeEnrollments.length > 0 ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"
                    )}>
                      {activeEnrollments.map((enrollment, index) => (
                        viewMode === 'grid' ? (
                          <CourseCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        ) : (
                          <CourseListCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        )
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No active courses"
                      description="You don't have any active courses at the moment."
                      actionText="Browse Available Courses"
                      onAction={() => setActiveTab("available")}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-2 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                <div className="space-y-4">
                  {enrollmentsLoading ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"
                    )}>
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className={cn(
                          "w-full bg-muted animate-pulse",
                          viewMode === 'grid' ? "h-[400px] rounded-[24px]" : "h-32 rounded-2xl"
                        )} />
                      ))}
                    </div>
                  ) : completedEnrollments.length > 0 ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"
                    )}>
                      {completedEnrollments.map((enrollment, index) => (
                        viewMode === 'grid' ? (
                          <CourseCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        ) : (
                          <CourseListCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        )
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No completed courses yet"
                      description="Finish a course to see it here and claim your certificate!"
                      actionText="Go to Enrolled Courses"
                      onAction={() => setActiveTab("enrolled")}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>

          </main>
          {/* Hidden: Learning Checklist sidebar (commented out, not removed) */}
          {/* <aside className="w-full lg:w-80">
            <div className="sticky top-6">
              <DashboardSidebar enrollments={enrollments} />
            </div>
          </aside> */}
        </div>
      </div>
    </>
  );
}
