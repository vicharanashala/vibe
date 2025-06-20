import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard, CourseCardSkeleton } from "@/components/course/CourseCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface CourseSectionProps {
  title: string;
  enrollments: Array<Record<string, unknown>>;
  isLoading: boolean;
  error?: string | null;
  totalEnrollments?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
  onRetry?: () => void;
  variant?: 'dashboard' | 'courses';
  skeletonCount?: number;
  emptyStateConfig?: {
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
  };
  className?: string;
}

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
  className
}: CourseSectionProps) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={variant === 'dashboard' ? "space-y-2" : "grid gap-4 md:grid-cols-2"}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <CourseCardSkeleton key={i} variant={variant} />
          ))}
        </div>
      );
    }

    if (error) {
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
        <div className={variant === 'dashboard' ? "space-y-2" : "grid gap-4 md:grid-cols-2"}>
          {enrollments.map((enrollment, index) => {
            const courseId = enrollment.courseId && typeof enrollment.courseId === 'object' && 'buffer' in enrollment.courseId
              ? Array.from(new Uint8Array((enrollment.courseId as { buffer: { data: number[] } }).buffer.data))
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('')
              : index.toString();

            return (
              <CourseCard 
                key={courseId} 
                enrollment={enrollment} 
                index={index} 
                variant={variant}
              />
            );
          })}
        </div>
        
        {/* Show pagination info for dashboard variant */}
        {variant === 'dashboard' && totalEnrollments > enrollments.length && (
          <Card className="border border-border p-4">
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
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Info className="h-4 w-4" />
          </Button>
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
