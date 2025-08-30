import { Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { useCourseById, useUserProgressPercentage } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { bufferToHex } from "@/utils/helpers";
import type { CourseCardProps } from '@/types/course.types';

export const CourseCard = ({ enrollment, index, variant = 'dashboard', className, completion, setCompletion }: CourseCardProps) => {
  const courseId = bufferToHex(enrollment.courseId);
  const versionId = bufferToHex(enrollment.courseVersionId) || "";
  
  const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
  const { data: progressData, isLoading: isProgressLoading } = useUserProgressPercentage(courseId, versionId);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();

  // Use real progress data or fallback to 0
  const progress = progressData ? Math.round(progressData.percentCompleted * 100) : 0;
  const totalLessons = progressData?.totalItems || 0;
  const completedLessons = progressData?.completedItems || 0;
  const isCompleted = (progressData?.percentCompleted !== undefined && progressData.percentCompleted >= 1) || progressData?.completed || false;

  const videoCount: number = enrollment.contentCounts?.videos || 0;
  const quizCount: number = enrollment.contentCounts?.quizzes || 0;
  const articleCount: number = enrollment.contentCounts?.articles || 0;

  console.log(videoCount, quizCount, articleCount, "---------count");

  // Find if this courseVersionId is already in completion
  const existingCompletionIndex = completion?.findIndex(
    (c) => c.courseVersionId === versionId
  );

  // If not found, append the user progress percentage to the list
  if (existingCompletionIndex === -1 && progressData) {
    setCompletion?.([
      ...(completion || []),
      {
        courseVersionId: versionId,
        percentage: progressData.percentCompleted,
        totalItems: progressData.totalItems,
        completedItems: progressData.completedItems
      },
    ]);
  }

  const handleContinue = () => {
    console.log("Setting course store:", {
      courseId: courseId,
      versionId: versionId
    });

    // Pass both courseId and versionId to the store
    setCurrentCourse({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null
    });

    navigate({ to: "/student/learn" });
  };

  if (isCourseLoading || isProgressLoading) {
    return <CourseCardSkeleton variant={variant} />;
  }

  if (variant === 'dashboard') {
    return (
      <Card className={`dark:bg-[#4b341e4b] border border-border overflow-hidden flex flex-row student-card-hover p-0 ${className || ''}`}>
        <div className="w-24 h-auto sm:w-32 flex-shrink-0 flex items-center justify-center">
          <ImageWithFallback
            src="https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6"
            alt={courseDetails?.name || `Course ${index + 1}`}
            aspectRatio="aspect-square"
            className="rounded-l-lg w-full h-full"
          />
        </div>
        <CardContent className="p-3 pl-0 flex flex-col flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center">
              <Badge className="bg-secondary/70 text-secondary-foreground border-0 font-normal">
                Course
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 border-0 font-normal ml-2">
                  Completed
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="flex flex-col sm:flex-row sm:gap-8">
                <div className="flex items-center gap-2 mb-1 sm:mb-0">
                  <span>Content</span>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {videoCount} videos , {quizCount} quizzes , {articleCount} articles
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1 sm:mb-0">
                  <span>Completion</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span>{progress}% ({completedLessons}/{totalLessons})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span>Enrolled</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">
                      {enrollment.enrollmentDate && typeof enrollment.enrollmentDate === 'string'
                        ? new Date(enrollment.enrollmentDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                        : 'Recently'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <h3 className="font-medium text-lg mb-auto">
            {courseDetails?.name || `Course ${index + 1}`}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {isCompleted
              ? 'Course completed!'
              : progress === 0
                ? 'Start your learning journey'
                : 'Continue Learning'}
          </p>
          <div className="mt-auto">
            <Button
              variant={progress === 0 ? "default" : isCompleted ? "secondary" : "default"}
              className={progress === 0 ? "" : isCompleted ? "" : "border-accent hover:bg-accent/10"}
              onClick={handleContinue}
            >
              {progress === 0 ? 'Start' : progress >= 100 ? 'Completed' : 'Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Courses page variant
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {courseDetails?.name || `Course ${index + 1}`}
            </CardTitle>
            <CardDescription>
              by <b>{courseDetails?.instructors
                ? (Array.isArray(courseDetails.instructors)
                  ? courseDetails.instructors.join(', ')
                  : courseDetails.instructors)
                : "Unknown Instructor"}</b>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline">{progress}% complete</Badge>
            {isCompleted && (
              <Badge className="bg-green-100 text-green-800 border-0 font-normal">
                Completed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {courseDetails?.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {courseDetails.description}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{completedLessons} of {totalLessons} lessons completed</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
        <Button className="w-full" onClick={handleContinue}>
          {progress === 0 ? 'Start Learning' : progress >= 100 ? 'Completed' : 'Continue Learning'}
        </Button>
      </CardContent>
    </Card>
  );
};

// Skeleton component for loading states
export const CourseCardSkeleton = ({ variant = 'dashboard' }: { variant?: 'dashboard' | 'courses' }) => {
  if (variant === 'dashboard') {
    return (
      <Card className="border border-border overflow-hidden flex flex-row student-card-hover p-0">
        <div className="w-24 h-auto sm:w-32 flex-shrink-0 flex items-center justify-center bg-muted animate-pulse">
          <div className="w-full h-full bg-muted rounded-l-lg"></div>
        </div>
        <CardContent className="p-3 pl-0 flex flex-col flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
            <div className="h-6 bg-muted rounded animate-pulse w-16"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
          </div>
          <div className="h-6 bg-muted rounded animate-pulse mb-2 w-3/4"></div>
          <div className="h-4 bg-muted rounded animate-pulse mb-3 w-1/2"></div>
          <div className="h-10 bg-muted rounded animate-pulse w-20"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="h-4 bg-muted rounded animate-pulse mb-2" />
        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
      </CardHeader>
      <CardContent>
        <div className="h-2 bg-muted rounded animate-pulse mb-4" />
        <div className="h-10 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
};