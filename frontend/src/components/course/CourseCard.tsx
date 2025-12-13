import { Clock, FileText, CheckCircle2, Trophy, Medal, Award, Crown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseById, useUserProgressPercentage, useLeaderboard } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';

export const CourseCard = ({ enrollment, index, isLoading, variant = 'dashboard', className, completion, setCompletion }: CourseCardProps) => {
  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";

  // const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const progress = Math.round(enrollment.percentCompleted || 0) as number 
  const contentCounts = enrollment.contentCounts as { totalItems?: number; videos?: number; quizzes?: number; articles?: number;project?: number } || {};
  const totalLessons = contentCounts.totalItems || 0;
  const completedLessons = enrollment.completedItems as number || 0;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;

  const videoCount: number = contentCounts.videos || 0;
  const quizCount: number = contentCounts.quizzes || 0;
  const articleCount: number = contentCounts.articles || 0;
  const projectCount: number = contentCounts.project || 0;


  // Find if this courseVersionId is already in completion
  const existingCompletionIndex = completion?.findIndex(
    (c) => c.courseVersionId === versionId
  );

  // If not found, append the user progress percentage to the list
  if (existingCompletionIndex === -1 && enrollment) {
    setCompletion?.([
      ...(completion || []),
      {
        courseVersionId: versionId,
        percentage: typeof progress === 'number' ? progress : 0,
        totalItems: typeof contentCounts.totalItems === 'number' ? contentCounts.totalItems : 0,
        completedItems: typeof completedLessons === 'number' ? completedLessons : 0
      },
    ]);
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

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

  if (isLoading) {
    return <CourseCardSkeleton variant={variant} />;
  }

  if (variant === 'dashboard') {
    return (
      <Card className={`dark:bg-[#4b341e4b] border border-border overflow-hidden flex flex-col sm:flex-row student-card-hover p-0 ${className || ''}`}>
        <div className="w-full h-40 sm:h-auto sm:w-32 flex-shrink-0 flex items-center justify-center">
          <ImageWithFallback
            src="https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6"
            alt={enrollment?.course?.name || `Course ${index + 1}`}
            aspectRatio="aspect-square"
            className="w-full h-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
          />
        </div>
        <CardContent className="p-3 sm:pl-0 flex flex-col flex-1">
          <div className="flex items-start justify-between xl:flex-row flex-col gap-2 mb-2">
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
              <div className="flex flex-col xl:flex-row gap-3 2xl:gap-8 xl:gap-4">
                {/* <div className="flex lg:flex-nowrap flex-wrap items-center gap-2 mb-1 xl:mb-0">
                  <span>Content</span>
                  <div className="flex items-center gap-1">
                    <div><FileText className="h-4 w-4" /></div>
                    {videoCount} videos , {quizCount} quizzes , {articleCount} articles , {projectCount} project
                  </div>
                </div> */}
                <div className="flex lg:flex-nowrap flex-wrap items-center gap-2 mb-1 xl:mb-0">
                  <Info className="h-4 w-4" />
                  <span>Ongoing training — subject to change</span>
                </div>
                <div className="flex items-center gap-2 mb-1 xl:mb-0">
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
            {enrollment?.course?.name || `Course ${index + 1}`}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {isCompleted
              ? 'Course completed!'
              : progress === 0
                ? 'Start your learning journey'
                : 'Continue Learning'}
          </p>
          <div className="mt-auto flex flex-col sm:flex-row gap-2">
            <Button
              variant={progress === 0 ? "default" : isCompleted ? "secondary" : "default"}
              className={`${progress === 0 ? "" : isCompleted ? "" : "border-accent hover:bg-accent/10"} w-full sm:w-auto`}
              onClick={handleContinue}
            >
              {progress === 0 ? 'Start' : progress >= 100 ? 'Completed' : 'Continue'}
            </Button>
            <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Trophy className="h-4 w-4 mr-2" />
                  Leaderboard
                </Button>
              </DialogTrigger>
              <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} />
            </Dialog>
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">View Details</Button>
              </DialogTrigger>
              <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 max-h-full flex flex-col">
                <DialogHeader className="mb-3 text-left">
                  <DialogTitle>Course Details</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[700px] overflow-y-auto">
                  <div className="space-y-6 py-2">
                    <div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Course Name</p>
                          <p>{enrollment?.course?.name || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Version</p>
                          <p>{enrollment?.courseVersion?.name || 'N/A'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Description</p>
                          <p className="text-sm">{enrollment?.course?.description || 'No description available'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Version Description</p>
                          <p className="text-sm">{enrollment?.courseVersion?.description || 'No version description available'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold">Content Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Contents</p>
                          <p className="text-xl font-semibold">{totalLessons}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Videos</p>
                          <p className="text-xl font-semibold">{videoCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Quizzes</p>
                          <p className="text-xl font-semibold">{quizCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Articles</p>
                          <p className="text-xl font-semibold">{articleCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Project</p>
                          <p className="text-xl font-semibold">{projectCount}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold">Enrollment Details</h3>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Enrolled On</p>
                          <p>{enrollment?.enrollmentDate ? formatDate(enrollment.enrollmentDate as string) : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Status</p>
                          <div className="flex items-center gap-1">
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span>In Progress</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
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
              {enrollment?.course?.name || `Course ${index + 1}`}
            </CardTitle>
            <CardDescription>
              by <b>{enrollment?.course?.instructors
                ? (Array.isArray(enrollment?.course.instructors)
                  ? enrollment?.course.instructors.join(', ')
                  : enrollment?.course.instructors)
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
        {enrollment?.course?.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {enrollment?.course.description}
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

// Leaderboard Dialog Component
const LeaderboardDialog = ({ courseId, versionId, courseName }: { courseId: string; versionId: string; courseName?: string }) => {
  const { data: leaderboardData, isLoading, error } = useLeaderboard(courseId, versionId, true);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bgColor: "bg-gradient-to-br from-yellow-400 to-yellow-600",
          textColor: "text-yellow-900",
          icon: <Crown className="h-5 w-5" />,
        };
      case 2:
        return {
          bgColor: "bg-gradient-to-br from-gray-300 to-gray-500",
          textColor: "text-gray-900",
          icon: <Medal className="h-5 w-5" />,
        };
      case 3:
        return {
          bgColor: "bg-gradient-to-br from-orange-400 to-orange-700",
          textColor: "text-orange-900",
          icon: <Award className="h-5 w-5" />,
        };
      default:
        return {
          bgColor: "bg-muted",
          textColor: "text-muted-foreground",
          icon: null,
        };
    }
  };

  return (
    <DialogContent className="max-w-6xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          {courseName || 'Course'} Leaderboard
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-4">
          Students ranked by completion percentage and completion time
        </p>
      </DialogHeader>
      
      <ScrollArea className="h-[600px] pr-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <p className="text-muted-foreground text-center py-8">{error}</p>
        )}

        {!isLoading && !error && (!leaderboardData || leaderboardData.length === 0) && (
          <p className="text-muted-foreground text-center py-8">
            No students enrolled yet
          </p>
        )}

        {!isLoading && !error && leaderboardData && leaderboardData.length > 0 && (
          <div className="space-y-2">
            {leaderboardData.map((entry) => {
              const rankStyle = getRankStyle(entry.rank);
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                    entry.rank <= 3
                      ? "bg-muted/50 border-2"
                      : "bg-muted/20",
                    entry.rank === 1 && "border-yellow-400",
                    entry.rank === 2 && "border-gray-400",
                    entry.rank === 3 && "border-orange-400"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-10 text-center">
                    {entry.rank <= 3 ? (
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mx-auto", rankStyle.bgColor)}>
                        <span className={cn("font-bold text-sm", rankStyle.textColor)}>
                          {entry.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-base font-semibold text-muted-foreground">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      className={cn(
                        entry.rank === 1 && "bg-yellow-100 text-yellow-800",
                        entry.rank === 2 && "bg-gray-100 text-gray-700",
                        entry.rank === 3 && "bg-orange-100 text-orange-700",
                        entry.rank > 3 && "bg-muted"
                      )}
                    >
                      {getInitials(entry.userName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name and Stats */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{entry.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {Math.round(entry.completionPercentage) === 100 ? (
                        <>
                          <span className="text-green-600 font-medium">
                            ✓ Completed
                          </span>
                          {entry.completedAt && (
                            <span className="ml-2">
                              on {new Date(entry.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      ) : (
                        `In Progress: ${Math.round(entry.completionPercentage)}%`
                      )}
                    </p>
                  </div>

                  {/* Completion Badge */}
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full font-semibold text-sm",
                      Math.round(entry.completionPercentage) === 100
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {Math.round(entry.completionPercentage)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </DialogContent>
  );
};