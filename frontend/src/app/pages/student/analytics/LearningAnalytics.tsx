import { useMemo } from "react";
import { RefreshCw, BookOpen, Target, GraduationCap, Activity } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollmentsDetails, useUserEnrollmentStats } from "@/hooks/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  toCourseAnalytics,
  aggregateContentMix,
  averageQuizPercent,
  overallItemsPerWeek,
} from "@/components/analytics/analytics-utils";
import { ContentMixCard } from "@/components/analytics/ContentMixCard";
import { QuizPerformanceCard } from "@/components/analytics/QuizPerformanceCard";
import { VelocityCard } from "@/components/analytics/VelocityCard";
import { CourseBreakdownTable } from "@/components/analytics/CourseBreakdownTable";

export default function LearningAnalytics() {
  const { token } = useAuthStore();
  const enabled = !!token;

  const { data: detailsData, isLoading: detailsLoading, refetch, } = useUserEnrollmentsDetails(enabled, "", "STUDENT");
  const { data: stats, isLoading: statsLoading } = useUserEnrollmentStats(enabled);

  const courses = useMemo(
    () => ((detailsData as any)?.enrollments || []).map((e: any, i: number) => toCourseAnalytics(e, i)),
    [detailsData],
  );

  const contentMix = useMemo(() => aggregateContentMix(courses), [courses]);
  const avgQuiz = useMemo(() => averageQuizPercent(courses), [courses]);
  const itemsPerWeek = useMemo(() => overallItemsPerWeek(courses), [courses]);

  const overallProgress = Math.round(stats?.overallProgress ?? 0);
  const completedCourses = stats?.completedCourses ?? courses.filter((c: any) => c.progress >= 100).length;
  const totalCourses = stats?.totalCourses ?? courses.length;
  // Sum lessons from per-course data (the stats aggregate often reports 0 here).
  const summedCompleted = courses.reduce((s: number, c: any) => s + c.completedItems, 0);
  const summedTotal = courses.reduce((s: number, c: any) => s + c.totalItems, 0);
  const completedItems = summedTotal > 0 ? summedCompleted : (stats?.completedItems ?? 0);
  const totalItems = summedTotal > 0 ? summedTotal : (stats?.totalItems ?? 0);
  const activeCourses = courses.filter((c: any) => c.progress < 100).length;

  const isLoading = detailsLoading || statsLoading;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Learning Analytics"
        description="Insights into your progress, pace and performance"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No analytics yet"
          description="Enroll in a course and start learning to see your analytics here."
        />
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="emerald" icon={<Target className="h-5 w-5" />} value={`${overallProgress}%`} label="Overall Progress" sublabel="Across all courses" />
            <StatCard tone="amber" icon={<BookOpen className="h-5 w-5" />} value={`${completedItems}/${totalItems}`} label="Lessons Completed" sublabel="Items finished" />
            <StatCard tone="violet" icon={<GraduationCap className="h-5 w-5" />} value={`${completedCourses}/${totalCourses}`} label="Courses Completed" sublabel="Fully finished" />
            <StatCard tone="blue" icon={<Activity className="h-5 w-5" />} value={`${activeCourses}`} label="Active Courses" sublabel="Currently in progress" />
          </div>

          {/* Pace + content mix + quiz performance */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <VelocityCard itemsPerWeek={itemsPerWeek} courses={courses} />
            <ContentMixCard mix={contentMix} />
            <QuizPerformanceCard courses={courses} average={avgQuiz} />
          </div>

          {/* Per-course breakdown */}
          <CourseBreakdownTable courses={courses} />
        </>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
