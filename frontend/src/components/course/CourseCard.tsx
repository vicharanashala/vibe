import { Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { useCourseById } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { bufferToHex } from "@/utils/helpers";

interface CourseCardProps {
  enrollment: Record<string, unknown>;
  index: number;
  variant?: 'dashboard' | 'courses';
  className?: string;
}

export const CourseCard = ({ enrollment, index, variant = 'dashboard', className }: CourseCardProps) => {
  const courseId = bufferToHex(enrollment.courseId);
  const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();

  // Mock progress data - replace with actual progress from enrollment
  const progress = Math.floor(Math.random() * 100);
  const totalLessons = Math.floor(Math.random() * 30) + 10;

  const handleContinue = () => {
    // Extract both courseId and versionId from enrollment
    const versionId = bufferToHex(enrollment.courseVersionId) || "";

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

  if (isCourseLoading) {
    return <CourseCardSkeleton variant={variant} />;
  }

  if (variant === 'dashboard') {
    return (
      <Card className={`border border-border overflow-hidden flex flex-row student-card-hover p-0 ${className || ''}`}>
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
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="flex flex-col sm:flex-row sm:gap-8">
                <div className="flex items-center gap-2 mb-1 sm:mb-0">
                  <span>Content</span>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {totalLessons} Lessons
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1 sm:mb-0">
                  <span>Completion</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary p-1">
                      <div className="h-full w-full rounded-full bg-primary relative">
                        <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-foreground text-[8px]">
                          {progress}%
                        </span>
                      </div>
                    </div>
                    <span>{progress}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span>Enrolled</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">
                      {enrollment.enrollmentDate && typeof enrollment.enrollmentDate === 'string'
                        ? new Date(enrollment.enrollmentDate).toLocaleDateString()
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
            Next: Continue Learning
          </p>
          <div className="mt-auto">
            <Button
              variant={progress === 0 ? "default" : "outline"}
              className={progress === 0 ? "" : "border-accent hover:bg-accent/10"}
              onClick={handleContinue}
            >
              {progress === 0 ? 'Start' : 'Continue'}
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
          <Badge variant="outline">{progress}% complete</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {courseDetails?.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {courseDetails.description}
          </p>
        )}
        <Progress value={progress} />
        <Button className="w-full" onClick={handleContinue}>
          Continue Learning
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
