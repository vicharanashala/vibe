import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard, CourseCardSkeleton } from "@/components/course/CourseCard";
import { CourseListCard } from "@/components/course/CourseListCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/utils/utils";
import type { CourseSectionProps } from '@/types/course.types';

export const CourseSection = ({
  title,
  enrollments,
  isLoading,
  error,
  totalEnrollments = 0,
  showViewAll = false,
  onViewAll,
  onRetry,
  variant = 'dashboard',
  skeletonCount = 3,
  emptyStateConfig,
  className,
  completion,
  setCompletion,
  cardVariant,
  viewMode = 'grid'
}: CourseSectionProps) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' 
            ? (variant === 'dashboard' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2") 
            : "grid-cols-1"
        )}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <CourseCardSkeleton key={i} variant={variant} />
          ))}
        </div>
      );
    }

    if (error) {
      if (error === "Authorization is required for request on GET /api/users/enrollments?page=1&limit=5") {
        onRetry?.()
      }
      return (
        <EmptyState
          title="Error loading courses"
          description={typeof error === 'string' ? error : "Failed to load courses. Please try again."}
          actionText="Try Again"
          onAction={onRetry}
          variant="error"
        />
      );
    }

    if (enrollments.length === 0) {
      if (emptyStateConfig) {
        return (
          <EmptyState
            title={emptyStateConfig.title}
            description={emptyStateConfig.description}
            actionText={emptyStateConfig.actionText}
            onAction={emptyStateConfig.onAction}
          />
        );
      }
      return (
        <EmptyState
          title="No courses found"
          description="Start your learning journey by enrolling in a course"
          actionText="Browse Courses"
          onAction={onViewAll}
        />
      );
    }

    return (
      <>
        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' 
            ? (variant === 'dashboard' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2") 
            : "grid-cols-1"
        )}>
          {enrollments
            .filter((enrollment: any) => enrollment && enrollment.courseVersionId)
            .map((enrollment: any, index) => {
              const courseId = enrollment.courseVersionId as string;
              const cohortId = enrollment?.cohortId as string;
              return viewMode === 'grid' ? (
                <CourseCard
                  key={courseId + cohortId}
                  enrollment={enrollment}
                  index={index}
                  variant={cardVariant || variant}
                  completion={completion}
                  isLoading={isLoading}
                  setCompletion={setCompletion}
                />
              ) : (
                <CourseListCard
                  key={courseId + cohortId}
                  enrollment={enrollment}
                  index={index}
                  variant={cardVariant || variant}
                  completion={completion}
                  isLoading={isLoading}
                  setCompletion={setCompletion}
                />
              );
            })}

          {showViewAll && onViewAll && viewMode === 'grid' && (
            <button
              type="button"
              onClick={onViewAll}
              aria-label="View all courses"
              className="group flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-primary/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-current/20 transition-transform group-hover:scale-110">
                <ArrowRight className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">View all courses</span>
            </button>
          )}
        </div>

        {/* Show pagination info for dashboard variant */}
        {variant === 'dashboard' && totalEnrollments > enrollments.length && (
          <Card className="border border-border p-4 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {enrollments.length} of {totalEnrollments} enrolled courses
              </p>
              {onViewAll && (
                <Button variant="outline" size="sm" onClick={onViewAll}>
                  View All Courses
                </Button>
              )}
            </div>
          </Card>
        )}
      </>
    );
  };

  return (
    <div className={className}>
      {title && (
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}

      {renderContent()}
    </div>
  );
};
