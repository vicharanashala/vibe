import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard, CourseCardSkeleton } from "@/components/course/CourseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  cardVariant
}: CourseSectionProps) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={variant === 'dashboard' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "grid gap-4 md:grid-cols-2"}>
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
        <div className={variant === 'dashboard' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "grid gap-4 md:grid-cols-2"}>
          {enrollments
            .filter((enrollment: any) => enrollment && enrollment.courseVersionId)
            .map((enrollment: any, index) => {
              const courseId = enrollment.courseVersionId as string;
              const cohortId = enrollment?.cohortId as string;
              return (
                <CourseCard
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {title === "In progress learning content"
                  ? "Courses you're currently enrolled in and actively learning"
                  : title === "Recommended for you"
                    ? "Personalized course recommendations based on your learning history and interests"
                    : "View detailed information about this section"
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        {showViewAll && onViewAll && (
          <Button
            variant="link"
            className="text-primary text-sm font-medium flex items-center"
            onClick={onViewAll}
          >
            View all
          </Button>
        )}
      </div>

      {renderContent()}
    </div>
  );
};
