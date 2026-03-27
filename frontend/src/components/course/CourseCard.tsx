import { Clock, Trophy, Medal, Award, Crown, Info, ExternalLink, Play, Activity, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, useCourseVersionById } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { Pagination } from "../ui/Pagination";
import { lazy, Suspense } from "react";

const EnrollmentDetailsDialog = lazy(() =>
  import("@/components/course/EnrollmentDetailsDialog").then(mod => ({
    default: mod.EnrollmentDetailsDialog
  }))
);

const StudentTimeslotModal = lazy(() =>
  import("@/components/course/StudentTimeslotModal").then(mod => ({
    default: mod.default
  }))
);

// Helper function to check if current time is within assigned time slot
const isCurrentTimeInTimeSlot = (timeSlotData?: any) => {
  if (!timeSlotData) return true; // No time slot restriction

  // Handle array or object
  const timeSlot = Array.isArray(timeSlotData) ? timeSlotData[0] : timeSlotData;
  if (!timeSlot || !timeSlot.from || !timeSlot.to) return true;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [fromHours, fromMinutes] = (timeSlot.from as string).split(':').map(Number);
  const [toHours, toMinutes] = (timeSlot.to as string).split(':').map(Number);
  const fromTime = fromHours * 60 + fromMinutes;
  const toTime = toHours * 60 + toMinutes;

  return currentTime >= fromTime && currentTime <= toTime;
};

export const CourseCard = ({ enrollment, index, isLoading, variant = 'dashboard', className, completion, setCompletion }: CourseCardProps) => {
  // Add null checks to prevent errors when enrollment data is incomplete
  if (!enrollment || !enrollment.courseId || !enrollment.courseVersionId) {
    console.error('Invalid enrollment data:', enrollment);
    return null;
  }
  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
  const cohortId = enrollment?.cohortId ? (typeof enrollment.cohortId === 'string' ? enrollment.cohortId : bufferToHex(enrollment.cohortId as any)) : "";


  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Fetch course version to get version name
  const { data: courseVersionData } = useCourseVersionById(
    versionId,
    variant !== 'available',
    cohortId || undefined,
  );

  const progress = Number(Math.min(enrollment.percentCompleted ?? 0, 100).toFixed(2));

  const hasAssignedTimeslot = enrollment.assignedTimeSlot &&
    Array.isArray(enrollment.assignedTimeSlot) &&
    enrollment.assignedTimeSlot.length > 0;

  const contentCounts = enrollment.contentCounts as { totalItems?: number } || {};
  const totalLessons = contentCounts.totalItems || 0;
  const completedLessons = enrollment.completedItems as number || 0;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;

  const GURU_SETU_VERSION_ID = "6981df886e100cfe04f9c4ae";
  const isNotGuruSetu = versionId !== GURU_SETU_VERSION_ID;

  // Robust check for HP system availability
  const isHpSystem = !!(
    enrollment.hpSystem ||
    enrollment.course?.hpSystem ||
    (enrollment.versionDetails && enrollment.versionDetails[0]?.hpSystem) ||
    courseVersionData?.hpSystem
  );

  const isRankVisible = variant !== 'available' && isNotGuruSetu;
  const isTimeslotActive = variant !== 'available' && isNotGuruSetu;

  // const videoCount: number = contentCounts.videos || 0;
  // const quizCount: number = contentCounts.quizzes || 0;
  // const articleCount: number = contentCounts.articles || 0;
  // const projectCount: number = contentCounts.project || 0;


  // const completedVideos: number = contentCounts.completedVideos || 0;
  // const completedQuizzes: number = contentCounts.quizzes || 0;
  // const completedArticles: number = contentCounts.articles || 0;
  // const completedProjects: number = contentCounts.project || 0;


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



  const handleContinue = () => {
    if (variant === 'available') {
      navigate({
        to: "/student/course-registration/$versionId/{-$cohort}",
        params: { versionId: versionId, cohort: cohortId }
      });
      return;
    }

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
      watchItemId: null,
      cohortName: enrollment.cohortName || null,
      cohortId: enrollment.cohortId || null
    });

    navigate({ to: "/student/learn" });
  };

  if (isLoading) {
    return <CourseCardSkeleton variant={variant} />;
  }

  if (variant === 'dashboard' || variant === 'available') {
    const themes = [
      { bg: "bg-[#F3E8FF]", icon: "text-[#A855F7]", progress: "bg-[#A855F7]", iconComponent: <Play className="h-10 w-10 md:h-12 md:w-12" /> },
      { bg: "bg-[#DBEAFE]", icon: "text-[#3B82F6]", progress: "bg-[#3B82F6]", iconComponent: <Activity className="h-10 w-10 md:h-12 md:w-12" /> },
      { bg: "bg-[#FCE7F3]", icon: "text-[#EC4899]", progress: "bg-[#EC4899]", iconComponent: <Users className="h-10 w-10 md:h-12 md:w-12" /> },
    ];
    const theme = themes[index % themes.length];
    const isStart = progress === 0 && variant !== 'available';

    return (
      <div className={cn("[perspective:1000px] transition-all duration-300 hover:-translate-y-1", className)}>
        <div className={cn("relative w-full transition-all duration-700 [transform-style:preserve-3d]", isFlipped && "[transform:rotateY(180deg)]")}>
          {/* Front Side - Determines the height */}
          <div className="relative w-full [backface-visibility:hidden]">
            <Card
              className={cn(
                "border-0 bg-white dark:bg-card overflow-hidden flex flex-col rounded-[24px] shadow-sm transition-shadow duration-300 group",
                variant !== 'available' ? "cursor-pointer hover:shadow-md" : "cursor-default"
              )}
              onClick={() => variant !== 'available' && setIsFlipped(true)}
            >
              {/* Thumbnail/Icon Area */}
              <div className={cn("relative w-full aspect-[4/3] flex items-center justify-center transition-colors duration-300", theme.bg)}>
                <div className={cn("transition-transform duration-500 group-hover:scale-110", theme.icon)}>
                  {theme.iconComponent}
                </div>
                {enrollment.hasNewItemsAfterCompletion && (
                  <Badge className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 border-0">New Content</Badge>
                )}
                <div className="absolute top-4 left-4 p-2 rounded-full bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="h-4 w-4 text-white" />
                </div>
              </div>

              <CardContent className="p-6 pb-10 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary" className="bg-[#F1F5F9] text-[#64748B] dark:bg-slate-800 dark:text-slate-400 border-0 font-medium px-3">Course</Badge>
                  {isCompleted && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 font-medium">Completed</Badge>}
                </div>

                <h3 className="font-bold text-xl text-foreground mb-1 line-clamp-2 leading-tight">{enrollment?.course?.name || `Course ${index + 1}`}</h3>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{enrollment?.course?.description || "Accelerate your learning journey"}</p>

                <div className="space-y-4">
                  {variant !== 'available' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-foreground">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#F1F5F9] dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", theme.progress)} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleContinue(); }}
                      disabled={!isCurrentTimeInTimeSlot(enrollment.assignedTimeSlot)}
                      className={cn(
                        "w-full h-12 rounded-xl text-lg font-bold transition-all duration-300 shadow-md active:scale-95 flex items-center justify-center gap-2",
                        variant === 'available' ? "bg-primary text-primary-foreground" : isStart ? "bg-[#22C55E] text-white" : "bg-[#FACC15] text-black"
                      )}
                    >
                      {variant === 'available' ? (
                        <span className="flex items-center gap-2">
                          Register Now
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      ) : (
                        <>
                          {isStart ? 'Start Course' : isCompleted ? 'View Course' : 'Continue Learning'}
                          <Play className="h-4 w-4 fill-current" />
                        </>
                      )}
                    </Button>

                    <div className="flex gap-2">
                      {isRankVisible && (
                        <div onClick={(e) => e.stopPropagation()} className="flex-1">
                          <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full rounded-lg border-2 h-10 text-[10px] lg:text-xs font-bold px-1" size="sm">
                                <Trophy className="h-3 w-3 lg:h-3.5 lg:w-3.5 mr-1 text-yellow-500 flex-shrink-0" />
                                <span className="truncate">Rank</span>
                              </Button>
                            </DialogTrigger>
                            <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} />
                          </Dialog>
                        </div>
                      )}
                      {variant !== 'available' && isHpSystem && (
                        <div onClick={(e) => e.stopPropagation()} className="flex-1">
                          <Button
                            variant="outline"
                            className="w-full rounded-lg border-2 h-10 text-[10px] lg:text-xs font-bold px-1"
                            size="sm"
                            onClick={() => navigate({ to: `/student/hp-system/${versionId}/${enrollment.cohortName || 'default'}/activities` })}
                          >
                            <Activity className="h-3 w-3 lg:h-3.5 lg:w-3.5 mr-1 text-blue-500 flex-shrink-0" />
                            <span className="truncate">HP</span>
                          </Button>
                        </div>
                      )}
                      {isTimeslotActive && (
                        <div onClick={(e) => e.stopPropagation()} className="flex-1">
                          <Button
                            variant="outline"
                            className="w-full rounded-lg border-2 h-10 text-[10px] lg:text-xs font-bold px-1"
                            size="sm"
                            onClick={() => setIsTimeslotModalOpen(true)}
                          >
                            <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5 mr-1 text-green-500 flex-shrink-0" />
                            <span className="truncate">{hasAssignedTimeslot ? 'Slot' : 'Pick Slot'}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Back Side - Stretches to match front height */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white dark:bg-slate-900 rounded-[24px] p-6 border-2 border-primary/20 shadow-xl flex flex-col cursor-pointer" onClick={() => setIsFlipped(false)}>
            <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
              <div className="flex items-center justify-between mb-4">
                <Badge className={cn("font-bold px-3 py-1", theme.bg, theme.icon.replace('text-', 'bg-').replace('[', '').replace(']', '/10'))}>
                  Course Details
                </Badge>
                <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <Play className={cn("h-5 w-5", theme.icon)} />
                </div>
              </div>

              <h3 className="font-bold text-lg text-foreground mb-4">{enrollment?.course?.name || `Course ${index + 1}`}</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Info className="h-3 w-3" /> Description
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                    {enrollment?.course?.description || "No description available for this course. Explore our structured curriculum designed to accelerate your learning journey."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Version</span>
                    <span className="text-foreground font-bold">{courseVersionData?.version || courseVersionData?.name || versionId.substring(0, 8)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Instructors</span>
                    <span className="text-foreground font-bold text-right truncate max-w-[120px]">
                      {enrollment?.course?.instructors?.join(', ') || "ViBe Team"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className={cn("grid gap-3", isTimeslotActive ? "grid-cols-2" : "grid-cols-1")} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  className="w-full rounded-lg h-9 text-[10px] font-bold border-2"
                  onClick={() => setIsDetailsOpen(true)}
                >
                  <Info className="h-3.5 w-3.5 mr-1 text-blue-500" />
                  Full Details
                </Button>
                {isTimeslotActive && (
                  <Button
                    variant="outline"
                    className="w-full rounded-lg h-9 text-[10px] font-bold border-2"
                    onClick={() => setIsTimeslotModalOpen(true)}
                    disabled={hasAssignedTimeslot}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1 text-green-500" />
                    {hasAssignedTimeslot ? 'Timeslot' : 'Pick Slot'}
                  </Button>
                )}
              </div>

              <Button
                onClick={(e) => { e.stopPropagation(); handleContinue(); }}
                disabled={!isCurrentTimeInTimeSlot(enrollment.assignedTimeSlot)}
                className={cn(
                  "w-full h-10 rounded-xl text-xs font-bold transition-all duration-300 shadow-md active:scale-95 flex items-center justify-center gap-2",
                  variant === 'available' ? "bg-primary text-primary-foreground" : isStart ? "bg-[#22C55E] text-white" : "bg-[#FACC15] text-black"
                )}
              >
                {variant === 'available' ? 'Register Now' : isStart ? 'Start Course' : isCompleted ? 'View Course' : 'Continue Learning'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <Suspense fallback={null}>
          {isDetailsOpen && (
            <div onClick={(e) => e.stopPropagation()}>
              <EnrollmentDetailsDialog
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                enrollment={enrollment}
              />
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <StudentTimeslotModal
              isOpen={isTimeslotModalOpen}
              onClose={() => setIsTimeslotModalOpen(false)}
              courseId={courseId}
              courseVersionId={versionId}
              currentUserId={""}
              hasAssignedTimeslot={!!hasAssignedTimeslot}
            />
          </div>
        </Suspense>
      </div>
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
            <Badge variant="outline">{progress.toFixed(2)}% complete</Badge>
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
            <span>{progress.toFixed(2)}%</span>
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
export const CourseCardSkeleton = ({ variant = 'dashboard' }: { variant?: 'dashboard' | 'courses' | 'available' }) => {
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
const LeaderboardDialog = ({ courseId, versionId, courseName, isOpen }: { courseId: string; versionId: string; courseName?: string, isOpen: boolean }) => {
  const [page, setPage] = useState(1);
  const { leaderboard,
    totalPages,
    totalDocuments,
    isLoading, error, myStats } = useLeaderboard(courseId, versionId, page, 10, isOpen);

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
    <DialogContent className="max-w-6xl h-[85vh] flex flex-col overflow-hidden">
      <DialogHeader className="flex-shrink-0 pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          {courseName || 'Course'} Leaderboard
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Students ranked by completion percentage and completion time
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <p className="text-muted-foreground text-center py-8">{error}</p>
          )}

          {!isLoading && !error && (!leaderboard || leaderboard.length === 0) && (
            <p className="text-muted-foreground text-center py-8">
              No students enrolled yet
            </p>
          )}

          {!isLoading && !error && leaderboard && leaderboard.length > 0 && (
            <div className="space-y-2 pb-4">
              {leaderboard.map((entry) => {
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
                                on {new Date(entry.completedAt).toLocaleString()}
                              </span>
                            )}
                          </>
                        ) : (
                          `In Progress: ${entry.completionPercentage.toFixed(2)}%`
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
      </div>
      <div className="flex-shrink-0 pt-4 border-t border-border/50 bg-background flex items-center justify-between">
        {/* My Stats */}
        {myStats ? (
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Your Rank</span>
              <span className="font-display font-bold text-lg text-gold">#{myStats.rank}</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Progress</span>
              <span className="font-semibold text-foreground">{Math.round(myStats.completionPercentage * 1000) / 1000}%</span>
            </div>
          </div>
        ) : (
          <div />
        )}
        {(totalPages ?? 0) > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalDocuments={totalDocuments}
            onPageChange={setPage}
          />
        )}
      </div>

    </DialogContent>
  );
};