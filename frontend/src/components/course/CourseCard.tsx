import { Clock, FileText, CheckCircle2, Trophy, Medal, Award, Crown, Info, ExternalLink, Copy, MessageCircle, Users, Check, Sparkles, LifeBuoy, Mail, Headphones, Play } from "lucide-react";
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
import { useCourseById, useUserProgressPercentage, useLeaderboard, useCourseVersionById, useGetTimeSlots } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { Pagination } from "../ui/Pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
const isCurrentTimeInTimeSlot = (timeSlot?: { from: string; to: string }) => {
  if (!timeSlot || !timeSlot.from || !timeSlot.to) return true; // No time slot restriction
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes since midnight
  
  const [fromHours, fromMinutes] = timeSlot.from.split(':').map(Number);
  const [toHours, toMinutes] = timeSlot.to.split(':').map(Number);
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
// console.log("---enrollment----", enrollment);
  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
  const cohortId = enrollment?.cohortId || "";
  const module_number = enrollment.moduleNumber || "";
  const section_number = enrollment.sectionNumber || "";
  const item_type = enrollment.itemType || "VIDEO";

  // Fetch course version to get supportLink
  const { data: courseVersionData } = useCourseVersionById(versionId, variant !== 'available');
  const supportLink = (courseVersionData as any)?.supportLink;

  // const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isForumOpen, setIsForumOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const supportEmail =
    enrollment.courseId === "692f030a945e82ec875e9116"
      ? "vibe-support@vicharanashala.zohodesk"
      : "internship-support@vicharanashala.zohodesk";

  // const progress = Math.round(enrollment.percentCompleted || 0) as number 
  const progress = Number(((enrollment.percentCompleted || 0)).toFixed(2));

  // Check if student already has assigned timeslots
  const hasAssignedTimeslot = enrollment.assignedTimeSlot && 
    Array.isArray(enrollment.assignedTimeSlot) && 
    enrollment.assignedTimeSlot.length > 0;

  const contentCounts = enrollment.contentCounts as { totalItems?: number; videos?: number; quizzes?: number; articles?: number; project?: number, totalQuizScore?: number, totalQuizMaxScore?: number, completedVideos?: number, completedQuizzes?: number, completedArticles?: number, completedProjects?: number } || {};
  const totalLessons = contentCounts.totalItems || 0;
  const completedLessons = enrollment.completedItems as number || 0;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;
  // const totalQuizScore = contentCounts.totalQuizScore as number || 0;
  // const totalQuizMaxScore = contentCounts.totalQuizMaxScore as number || 0;

  // const videoCount: number = contentCounts.videos || 0;
  // const quizCount: number = contentCounts.quizzes || 0;
  // const articleCount: number = contentCounts.articles || 0;
  // const projectCount: number = contentCounts.project || 0;


  // const completedVideos: number = contentCounts.completedVideos || 0;
  // const completedQuizzes: number = contentCounts.completedQuizzes || 0;
  // const completedArticles: number = contentCounts.completedArticles || 0;
  // const completedProjects: number = contentCounts.completedProjects || 0;


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
    if (variant === 'available') {
      navigate({
        to: "/student/course-registration/$versionId/{-$cohortId}",
        params: { versionId: versionId, cohortId: cohortId }
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
    return (
      <>
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
          {/* isCompleted && */}
           {enrollment.hasNewItemsAfterCompletion && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs my-1">
              New content added
            </Badge>
          )}
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      <p>This course is actively updated with new content.</p>
                    </TooltipContent>
                  </Tooltip>
                  <span>Ongoing training — subject to change</span>
                </div>
                {variant !== 'available' && (
                  <div className="flex items-center gap-2">
                    <span>Completion Percentage</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{progress.toFixed(2)}%</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={8}>
                            <p>Percentage of course items you have completed</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
                {variant !== 'available' && (
                  <div className="flex items-center gap-2">
                    <span>Enrolled At</span>
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
                )}
              </div>
            </div>
          </div>
          <h3 className="font-medium text-lg mb-auto">
            {enrollment?.course?.name || `Course ${index + 1}`}
            {enrollment?.cohortName && (
              <span className="font-medium text-[80%] mb-auto ml-5">
                (Cohort: {enrollment.cohortName})
              </span>
            )}
          </h3>

          <p className="text-xs text-muted-foreground mb-3">
            {isCompleted
              ? 'Course completed!'
              : progress === 0
                ? 'Start your learning journey'
                : 'Continue Learning'}

            &nbsp;&nbsp;&nbsp;
            {isCompleted ? "" : (progress == 0) ? "" : <span>&bull; MOD {module_number} &bull; SEC {section_number} &bull; {item_type}</span>}
          {variant !== 'available' && enrollment.assignedTimeSlot && (
              <span className="ml-2 inline-flex items-center gap-1.5">
               
                <span className="font-bold">Time Slot:</span>
                  {
                    enrollment.assignedTimeSlot && enrollment.assignedTimeSlot.map((timeSlot, index) => (
                <span className="inline-flex items-center gap-1 px-2 py-0 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">
                  <Clock className="h-3 w-3" />
                      <span key={index}>
                        {timeSlot.from} - {timeSlot.to} IST
                      </span>
                </span>
                    ))
                  }
              </span>
            )}
          </p>
          <div className="mt-auto flex flex-col sm:flex-row gap-2">
            <Button
              variant={variant === 'available' ? "default" : progress === 0 ? "default" : isCompleted ? "default" : "default"}
              className={`${variant === 'available'
                ? ""
                : progress === 0
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-md border-0"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                // : isCompleted
                //   ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                //   : "bg-blue-600 hover:bg-blue-700 text-white shadow-md border-0"
                } w-full sm:w-auto transition-all duration-200`}
              onClick={handleContinue}
               disabled={!isCurrentTimeInTimeSlot(enrollment.assignedTimeSlot)}
            >
              {variant === 'available' ? 'Register' : progress === 0 ? 'Start' : progress >= 100 ? 'Completed' : 'Continue'}
            </Button>
            {variant !== 'available' && enrollment.courseVersionId !== "6981df886e100cfe04f9c4ae" && <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Trophy className="h-4 w-4 mr-2" />
                  Leaderboard
                </Button>
              </DialogTrigger>
              <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} />
            </Dialog>}
            {
              enrollment.courseVersionId !== "6981df886e100cfe04f9c4ae" && isDetailsOpen && (
                <Suspense fallback={null}>
                  <EnrollmentDetailsDialog
                    isOpen={isDetailsOpen}
                    onOpenChange={setIsDetailsOpen}
                    enrollment={enrollment}
                  />
                </Suspense>
              )
            }
            {variant !== 'available' && enrollment.courseVersionId !== "6981df886e100cfe04f9c4ae" && (
              <>
                <Button 
                  onClick={() => setIsTimeslotModalOpen(true)} 
                  variant="outline" 
                  className="w-full sm:w-auto mb-2"
                  disabled={hasAssignedTimeslot}
                >
                  {hasAssignedTimeslot ? 'Timeslot Assigned' : 'Choose Timeslot'}
                </Button>
                <Button onClick={() => setIsDetailsOpen(true)} variant="outline" className="w-full sm:w-auto">View Details</Button>
              </>
            )}
            {/* {enrollment.courseVersionId!=="6981df886e100cfe04f9c4ae"&& <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
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
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Quiz Scores</p>
                          <p className="text-xl font-semibold">{totalQuizScore} / {totalQuizMaxScore}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold">Completion Details</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Total Completed</p>
                          <p className="text-xl font-semibold">{completedLessons} / {totalLessons}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Videos Watched</p>
                          <p className="text-xl font-semibold">{completedVideos} / {videoCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Quizzes Completed</p>
                          <p className="text-xl font-semibold">{completedQuizzes} / {quizCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Articles Read</p>
                          <p className="text-xl font-semibold">{completedArticles} / {articleCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Projects Done</p>
                          <p className="text-xl font-semibold">{completedProjects} / {projectCount}</p>
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
            </Dialog>} */}
            

            {variant !== 'available' && supportLink && (() => {
              const isEmail = supportLink.startsWith('mailto:') || (!supportLink.startsWith('http://') && !supportLink.startsWith('https://') && !supportLink.startsWith('//') && supportLink.includes('@'));
              const href = supportLink.startsWith('mailto:')
                ? supportLink
                : supportLink.startsWith('http://') || supportLink.startsWith('https://') || supportLink.startsWith('//')
                  ? supportLink
                  : supportLink.includes('@')
                    ? `mailto:${supportLink}`
                    : supportLink;
              return (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <a
                    href={href}
                    target={isEmail ? undefined : "_blank"}
                    rel={isEmail ? undefined : "noopener noreferrer"}
                    className="flex items-center gap-2"
                  >
                    <Headphones className="h-4 w-4" />
                    Get Support
                  </a>
                </Button>
              );
            })()}

            {/* JUST ADD THIS FOR MERN CASE STUDY COURSE ONLY */}
            {variant !== 'available' && enrollment.courseId === "692f030a945e82ec875e9116" && (
              <Dialog open={isForumOpen} onOpenChange={setIsForumOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Discussion Forum
                  </Button>
                </DialogTrigger>

                <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 max-h-full flex flex-col">
                  <DialogHeader className="mb-3 text-left">
                    <DialogTitle>Forum Details</DialogTitle>
                  </DialogHeader>

                  <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[800px] overflow-y-auto">
                    <>
                      <Separator className="mb-6" />

                      <div className="space-y-4">

                        {/* Section Header */}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-primary-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold">Discord Community</h3>
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>

                        {/* Discord Card */}
                        <div className="rounded-xl border bg-primary/5 shadow-sm hover:shadow-md transition-all">
                          <div className="p-6 space-y-5">

                            {/* Top Section */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-14 h-14 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
                                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                  </svg>
                                </div>

                                <div className="min-w-0">
                                  <p className="font-semibold text-base">
                                    Join Our Community
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Connect with fellow students
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                Active
                              </div>
                            </div>

                            {/* Features */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border bg-primary/5">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="font-medium">Student Network</span>
                              </div>
                              <div className="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border bg-primary/5">
                                <MessageCircle className="w-4 h-4 text-primary" />
                                <span className="font-medium">Live Discussions</span>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground leading-relaxed px-4 py-3 rounded-lg border bg-primary/5">
                              Get help, share resources, and connect with your coursemates in
                              our exclusive Discord server.
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-2.5 pt-1">
                              <Button asChild className="flex-1">
                                <a
                                  href="https://discord.gg/kKNBu3PF"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Join Discord
                                </a>
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      "https://discord.gg/kKNBu3PF"
                                    );
                                    setCopied(true);
                                    setCopyError(false);
                                    setTimeout(() => setCopied(false), 2000);
                                  } catch {
                                    setCopyError(true);
                                    setTimeout(() => setCopyError(false), 2000);
                                  }
                                }}
                                disabled={copied}
                              >
                                {copied ? (
                                  <Check className="w-4 h-4 text-primary" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>

                            {/* Feedback */}
                            {copied && (
                              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg border">
                                <Check className="w-4 h-4" />
                                Link copied to clipboard
                              </div>
                            )}

                            {copyError && (
                              <div className="flex items-center gap-2 text-sm text-destructive bg-primary/5 px-3 py-2 rounded-lg border">
                                <span>Failed to copy link</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}

            {/* Dynamic Support Link - shown if configured by instructor */}
            {(enrollment.courseVersion as any)?.supportLink && (
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-700 dark:text-green-400"
                asChild
              >
                <a
                  href={
                    (enrollment.courseVersion as any).supportLink.startsWith('mailto:') || (enrollment.courseVersion as any).supportLink.includes('@')
                      ? (enrollment.courseVersion as any).supportLink.startsWith('mailto:')
                        ? (enrollment.courseVersion as any).supportLink
                        : `mailto:${(enrollment.courseVersion as any).supportLink}`
                      : (enrollment.courseVersion as any).supportLink
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Headphones className="h-4 w-4" />
                  Get Support
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}

            {/* Legacy hardcoded support - only show if no dynamic supportLink is configured */}
            {!(enrollment.courseVersion as any)?.supportLink && (
              enrollment.courseId === "6943b2cafa4e840eb39490b6" ||
              enrollment.courseId === "692f030a945e82ec875e9116"
            ) && (
                <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      Support
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 max-h-full flex flex-col">
                    <DialogHeader className="mb-3 text-left">
                      <DialogTitle>Support Details</DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[800px] overflow-y-auto">
                      <>
                        <Separator className="mb-6" />

                        <div className="space-y-4">
                          {/* Section Header */}
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                              <LifeBuoy className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">Internship Support</h3>
                          </div>

                          {/* Support Card */}
                          <div className="rounded-xl border bg-primary/5 shadow-sm hover:shadow-md transition-all">
                            <div className="p-6 space-y-5">
                              {/* Top */}
                              <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                                  <Mail className="w-7 h-7" />
                                </div>

                                <div>
                                  <p className="font-semibold text-base">
                                    Contact Support
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    We usually respond within 24 hours
                                  </p>
                                </div>
                              </div>

                              {/* Description */}
                              <p className="text-sm text-muted-foreground leading-relaxed px-4 py-3 rounded-lg border bg-primary/5">
                                For course-related queries, guidance, or issues, feel free to
                                reach out to our support team via email.
                              </p>

                              {/* Email */}
                              <div className="flex items-center gap-2.5">
                                <Button asChild className="flex-1">
                                  <a
                                    href={`mailto:${supportEmail}`}
                                    className="flex items-center justify-center gap-2"
                                  >
                                    <Mail className="w-4 h-4" />
                                    {supportEmail}
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}



          </div>
        </CardContent>
      </Card>

      {/* Student Timeslot Modal */}
      <Suspense fallback={null}>
        <StudentTimeslotModal
          isOpen={isTimeslotModalOpen}
          onClose={() => setIsTimeslotModalOpen(false)}
          courseId={courseId}
          courseVersionId={versionId}
          currentUserId={""} // TODO: Get current user ID
          hasAssignedTimeslot={hasAssignedTimeslot}
        />
      </Suspense>
      </>
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