import { Clock, Trophy, Medal, Info, ExternalLink, Copy, MessageCircle, Users, Check, Sparkles, Play, Activity, Shield as LucideShield, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, useCourseVersionById, useCheckTimeSlotAccessOnDemand } from "@/hooks/hooks";
import { toast } from "sonner";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState, lazy, useEffect } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { StudentPolicyModal } from "@/app/pages/student/components/policies/StudentPolicyModal";


import { EnrollmentDetailsDialog } from "@/components/course/EnrollmentDetailsDialog";
import { CourseQuickDetailsDialog } from "@/components/course/CourseQuickDetailsDialog";
import { Pagination } from "../ui/Pagination";
import { LeaderboardLeagues } from "@/components/course/LeaderboardLeagues";

const StudentTimeslotModal = lazy(() =>
  import("@/components/course/StudentTimeslotModal").then(mod => ({
    default: mod.default
  }))
);

// Helper function to check if current time is within assigned time slot
export const CourseCard = ({ enrollment, index, isLoading, variant = 'dashboard', className }: CourseCardProps) => {
  // Add null checks to prevent errors when enrollment data is incomplete
  if (!enrollment || !enrollment.courseId || !enrollment.courseVersionId) {
    console.error('Invalid enrollment data:', enrollment);
    return null;
  }
  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
  const cohortId = enrollment?.cohortId ? (typeof enrollment.cohortId === 'string' ? enrollment.cohortId : bufferToHex(enrollment.cohortId as any)) : "";
  // const module_number = enrollment.moduleNumber || "";
  // const section_number = enrollment.sectionNumber || "";
  // const item_type = enrollment.itemType || "VIDEO";
  const [showPolicies, setShowPolicies] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Fetch course version to get supportLink
  const { data: courseVersionData } = useCourseVersionById(
    versionId,
    variant !== 'available',
    cohortId || undefined,
  );
  const supportLink = (courseVersionData as any)?.supportLink;

  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const { check: checkTimeSlotAccess } = useCheckTimeSlotAccessOnDemand();
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isForumOpen, setIsForumOpen] = useState(false);
  // const [showPolicies, setShowPolicies] = useState(false);

  const progress = Number(Math.min(enrollment.percentCompleted ?? 0, 100).toFixed(2));

  const hasAssignedTimeslot = Array.isArray(enrollment.assignedTimeSlot)
    ? enrollment.assignedTimeSlot.length > 0
    : !!enrollment.assignedTimeSlot;

  const contentCounts = enrollment.contentCounts || {};
  const itemCounts = (contentCounts as any).itemCounts || {};

  // Also get counts from courseVersionData as fallback
  const versionItemCounts = (courseVersionData as any)?.itemCounts || {};
  const totalLessons = Number(contentCounts.totalItems || (courseVersionData as any)?.totalItems || 0);

  const videoCount = Number(
    (contentCounts as any).videos ?? itemCounts.VIDEO ?? itemCounts.video ?? itemCounts.videos ??
    versionItemCounts.VIDEO ?? versionItemCounts.video ?? versionItemCounts.videos ?? 0
  );
  const quizCount = Number(
    (contentCounts as any).quizzes ?? itemCounts.QUIZ ?? itemCounts.quiz ?? itemCounts.quizzes ??
    versionItemCounts.QUIZ ?? versionItemCounts.quiz ?? versionItemCounts.quizzes ?? 0
  );
  const articleCount = Number(
    (contentCounts as any).articles ?? itemCounts.BLOG ?? itemCounts.blog ?? itemCounts.articles ??
    versionItemCounts.BLOG ?? versionItemCounts.blog ?? versionItemCounts.articles ?? 0
  );
  const projectCount = Number(
    (contentCounts as any).project ?? (contentCounts as any).projects ?? itemCounts.PROJECT ?? itemCounts.project ?? itemCounts.projects ??
    versionItemCounts.PROJECT ?? versionItemCounts.project ?? versionItemCounts.projects ?? 0
  );

  const modules = (courseVersionData as any)?.modules || [];
  const moduleCount = modules.length;
  const sectionCount = modules.reduce((sum: number, m: any) => sum + (m.sections?.length || 0), 0);

  const timeSlot = Array.isArray(enrollment.assignedTimeSlot)
    ? enrollment.assignedTimeSlot[0]
    : enrollment.assignedTimeSlot;
  const timeslotStr = timeSlot
    ? `${timeSlot.from} - ${timeSlot.to} (IST)`
    : 'Access Anytime';

  const completedLessons = enrollment.completedItems as number || 0;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;

  const GURU_SETU_VERSION_ID = "6981df886e100cfe04f9c4ae";
  const isNotGuruSetu = versionId !== GURU_SETU_VERSION_ID;

  // Robust check for HP system availability
  const isHpSystem = !!(
    (enrollment.hpSystem || (enrollment as any).hpSystem) ||
    ((enrollment.course as any)?.hpSystem) ||
    ((enrollment as any).versionDetails && (enrollment as any).versionDetails[0]?.hpSystem) ||
    (courseVersionData as any)?.hpSystem
  );

  const isStart = progress === 0 && variant !== 'available';
  const isRankVisible = variant !== 'available' && isNotGuruSetu;
  const isTimeslotActive = variant !== 'available' && isNotGuruSetu;

  // const supportLink = enrollment?.course?.supportLink || "";



  useEffect(() => {
    if (!enrollment) return

  })

  const handleContinue = async () => {
    if (variant === 'available') {
      navigate({
        to: "/student/course-registration/$versionId/{-$cohort}",
        params: { versionId: versionId, cohort: cohortId }
      });
      return;
    }

    // Time-slot ("commitment") gate at entry: only let the student in during a
    // booked window. The backend getItem gate is the safety net.
    const access = await checkTimeSlotAccess(courseId, versionId);
    if (!access.canAccess) {
      toast.error(access.message || "You can only access this course during your booked time slot.");
      return;
    }

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
      {
        bg: "bg-[#F3E8FF]", icon: "text-[#A855F7]", iconDark: "dark:text-violet-300", progress: "bg-[#A855F7]",
        bannerLight: "bg-gradient-to-br from-violet-100 via-violet-50 to-white",
        bannerDark: "dark:from-violet-500/25 dark:via-violet-500/5 dark:to-transparent",
        glow: "bg-violet-500/25",
        iconComponent: <Play className="w-8 md:w-10 h-8 md:h-10" />,
      },
      {
        bg: "bg-[#DBEAFE]", icon: "text-[#3B82F6]", iconDark: "dark:text-blue-300", progress: "bg-[#3B82F6]",
        bannerLight: "bg-gradient-to-br from-blue-100 via-blue-50 to-white",
        bannerDark: "dark:from-blue-500/25 dark:via-blue-500/5 dark:to-transparent",
        glow: "bg-blue-500/25",
        iconComponent: <Activity className="w-8 md:w-10 h-8 md:h-10" />,
      },
      {
        bg: "bg-[#FCE7F3]", icon: "text-[#EC4899]", iconDark: "dark:text-pink-300", progress: "bg-[#EC4899]",
        bannerLight: "bg-gradient-to-br from-pink-100 via-pink-50 to-white",
        bannerDark: "dark:from-pink-500/25 dark:via-pink-500/5 dark:to-transparent",
        glow: "bg-pink-500/25",
        iconComponent: <Users className="w-8 md:w-10 h-8 md:h-10" />,
      },
    ];
    const theme = themes[index % themes.length];

    const continueLabel = variant === 'available' ? 'Register Now' : isStart ? 'Start Course' : isCompleted ? 'View Course' : 'Continue';
    const versionLabel = courseVersionData?.version || courseVersionData?.name || versionId.substring(0, 8);

    return (
      <div className={cn("transition-all hover:-translate-y-1 duration-300 ease-out", className)}>
        <div className="relative w-full">
          {/* Card content */}
          <div className="relative w-full">
            <Card
              className={cn(
                "group flex flex-col gap-0 py-0 shadow-sm rounded-[24px] overflow-hidden transition-shadow duration-300",
                "border bg-white border-neutral-200/80 ring-1 ring-black/[0.02]",
                "dark:bg-white/[0.03] dark:border-white/[0.07] dark:ring-white/[0.04]",
                variant !== 'available' ? "hover:shadow-md" : ""
              )}
            >
              {/* Thumbnail/Icon Area — soft tint in light, dark gradient + accent glow in dark */}
              <div className={cn(
                "relative flex justify-center items-center w-full aspect-video overflow-hidden transition-colors duration-300",
                theme.bannerLight,
                "dark:bg-[#17171a] dark:bg-gradient-to-br", theme.bannerDark
              )}>
                {/* Accent glow for a glossy, on-theme feel */}
                <div aria-hidden className={cn("pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-90", theme.glow)} />
                <div className={cn("relative group-hover:scale-110 transition-transform duration-500", theme.icon, theme.iconDark)}>
                  {theme.iconComponent}
                </div>
                {enrollment.hasNewItemsAfterCompletion && (
                  <Badge className="top-3 right-3 absolute bg-yellow-400 border-0 text-yellow-900">New Content</Badge>
                )}
                {/* Tags overlaid on top of the thumbnail */}
                <div className="top-3 left-3 absolute flex flex-wrap items-center gap-1.5">
                  {enrollment.cohortName && (
                    <Badge variant="outline" className="bg-white/90 dark:bg-black/40 backdrop-blur-sm px-2.5 border-primary/30 dark:border-blue-400/30 font-medium text-primary dark:text-blue-300">
                      {enrollment.cohortName}
                    </Badge>
                  )}
                  {isCompleted && <Badge className="bg-green-100 dark:bg-green-900/40 border-0 font-medium text-green-700 dark:text-green-400">Completed</Badge>}
                </div>
              </div>

              <CardContent className="flex flex-col p-4">
                <h3
                  className="mb-1 min-h-[2.75rem] font-bold text-foreground text-lg break-words line-clamp-2 leading-tight"
                  title={enrollment?.course?.name || `Course ${index + 1}`}
                >
                  {enrollment?.course?.name || `Course ${index + 1}`}
                </h3>
                <div className="mt-3 space-y-4">
                  {variant !== 'available' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center font-semibold text-sm">

                        {enrollment.courseId !== "6981df886e100cfe04f9c4ad" && <> <span className="text-muted-foreground">Progress</span><span className="text-foreground">{progress.toFixed(0)}%</span></>}
                      </div>

                      {enrollment.courseId !== "6981df886e100cfe04f9c4ad" ? (<div className="bg-[#F1F5F9] dark:bg-white/10 rounded-full w-full h-2 overflow-hidden">
                        <div className={cn("rounded-full h-full transition-all duration-700 ease-out", theme.progress)} style={{ width: `${progress}%` }} />
                      </div>) : (<div className="flex justify-between items-center font-semibold text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{enrollment.completedItems}/{enrollment.contentCounts?.totalItems} (More videos soon)</span>
                      </div>)}

                      {enrollment.courseId !== "6981df886e100cfe04f9c4ad" && totalLessons > 0 && (
                        <p className="text-muted-foreground text-xs">{completedLessons} of {totalLessons} lessons</p>
                      )}

                    </div>
                  )}

                  <div className="gap-3 grid grid-cols-1 pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleContinue(); }}
                        className={cn(
                          "flex flex-1 justify-center items-center gap-2 shadow-md rounded-xl h-10 font-bold text-sm active:scale-95 transition-all duration-300",
                          variant === 'available' ? "bg-primary text-primary-foreground" : isStart ? "bg-[#22C55E] text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {variant === 'available' ? (
                          <span className="flex items-center gap-2">
                            Register Now
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        ) : (
                          <>
                            {isStart ? 'Start Course' : isCompleted ? 'View Course' : 'Continue'}
                            <Play className="fill-current w-4 h-4" />
                          </>
                        )}
                      </Button>

                      {variant !== 'available' && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setIsQuickOpen(true); }}
                          className="border-2 rounded-xl w-10 h-10"
                          aria-label="View course details"
                          title="More details"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      )}

                      {isTimeslotActive && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setIsTimeslotModalOpen(true); }}
                          className="border-2 rounded-xl w-10 h-10"
                          aria-label="Pick Slot"
                          title="Pick Slot"
                        >
                          <Clock className="w-4 h-4 text-green-500" />
                        </Button>
                      )}

                      {variant !== 'available' && isNotGuruSetu && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="border-2 rounded-xl w-10 h-10" aria-label="More course actions">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {isRankVisible && (
                                <DropdownMenuItem onClick={() => setIsLeaderboardOpen(true)}>
                                  <Trophy className="mr-2 w-4 h-4 text-yellow-500" /> Leaderboard
                                </DropdownMenuItem>
                              )}
                              {isHpSystem && (
                                <DropdownMenuItem onClick={() => navigate({ to: `/student/hp-system/${versionId}/${enrollment.cohortName || 'default'}/activities` })}>
                                  <Activity className="mr-2 w-4 h-4 text-blue-500" /> HP System
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setIsDetailsOpen(true)}>
                                <Info className="mr-2 w-4 h-4 text-blue-500" /> Full Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowPolicies(true)}>
                                <LucideShield className="mr-2 w-4 h-4 text-indigo-500" /> Policies
                              </DropdownMenuItem>
                              {supportLink && (
                                <DropdownMenuItem onClick={() => setIsForumOpen(true)}>
                                  <MessageCircle className="mr-2 w-4 h-4 text-blue-500" /> Forum
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <CourseQuickDetailsDialog
          isOpen={isQuickOpen}
          onOpenChange={setIsQuickOpen}
          courseName={enrollment?.course?.name || `Course ${index + 1}`}
          description={enrollment?.course?.description}
          versionLabel={versionLabel}
          cohortName={enrollment.cohortName}
          totalLessons={totalLessons}
          moduleCount={moduleCount}
          sectionCount={sectionCount}
          videoCount={videoCount}
          quizCount={quizCount}
          articleCount={articleCount}
          projectCount={projectCount}
          timeslotStr={timeslotStr}
          hasTimeslot={!!timeSlot}
          variant={variant}
          isStart={isStart}
          isCompleted={isCompleted}
          isTimeslotActive={isTimeslotActive}
          hasAssignedTimeslot={!!hasAssignedTimeslot}
          continueLabel={continueLabel}
          onContinue={() => { setIsQuickOpen(false); handleContinue(); }}
          onFullDetails={() => { setIsQuickOpen(false); setIsDetailsOpen(true); }}
          onTimeslot={() => { setIsQuickOpen(false); setIsTimeslotModalOpen(true); }}
        />

        <EnrollmentDetailsDialog
          isOpen={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          enrollment={enrollment}
        />
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
        <StudentPolicyModal
          open={showPolicies}
          onClose={() => setShowPolicies(false)}
          courseId={courseId}
          courseVersionId={versionId}
          cohortId={cohortId}
          enrollmentDate={enrollment.enrollmentDate}
          currentProgressPercent={progress}
        />

        {/* Leaderboard — opened from the overflow menu (kept fully functional) */}
        {isRankVisible && (
          <div onClick={(e) => e.stopPropagation()}>
            <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
              <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} cohortId={cohortId} />
            </Dialog>
          </div>
        )}

        {/* Forum — opened from the overflow menu (kept fully functional) */}
        {variant !== 'available' && isNotGuruSetu && supportLink && (
          <div onClick={(e) => e.stopPropagation()}>
            <Dialog open={isForumOpen} onOpenChange={setIsForumOpen}>
              <DialogContent className="w-full max-w-lg">
                <DialogHeader>
                  <DialogTitle>Forum Details</DialogTitle>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex justify-center items-center bg-primary rounded-lg w-8 h-8">
                      <MessageCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg">Discord Community</h3>
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-5 bg-primary/5 p-6 border rounded-xl">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex justify-center items-center bg-[#5865F2] shadow-md rounded-xl w-14 h-14">
                          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-base">Join Our Community</p>
                          <p className="text-muted-foreground text-sm">Connect with fellow students</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Get help, share resources, and connect with your coursemates in our exclusive Discord server.
                    </p>
                    <div className="flex items-center gap-2.5 pt-1">
                      <Button asChild className="flex-1">
                        <a href={supportLink} target="_blank" rel="noopener noreferrer" className="flex justify-center items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Join Discord
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(supportLink);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {
                            setCopyError(true);
                            setTimeout(() => setCopyError(false), 2000);
                          }
                        }}
                        disabled={copied}
                      >
                        {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {(copied || copyError) && (
                      <div className={cn("flex items-center gap-2 px-3 py-2 border rounded-lg text-xs", copied ? "text-primary bg-primary/10 border-primary/20" : "text-red-500 bg-red-50 border-red-100")}>
                        {copied ? <Check className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                        {copied ? "Link copied to clipboard" : "Failed to copy link"}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    );
  }

  // Courses page variant
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-start">
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
              <Badge className="bg-green-100 border-0 font-normal text-green-800">
                Completed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
               <span>{progress.toFixed(2)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="gap-4 grid grid-cols-2 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{completedLessons} / {totalLessons} Lessons</span>
            </div>
            {enrollment.enrollmentDate && (
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4" />
                <span>Enrolled {new Date(enrollment.enrollmentDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleContinue} className="flex-1">
              {isStart ? 'Start Course' : 'Continue'}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              {isRankVisible && (
                <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Leaderboard">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                    </Button>
                  </DialogTrigger>
                  <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} cohortId={cohortId} />
                </Dialog>
              )}
              {isHpSystem && (
                <Button variant="outline" size="icon" title="HP System" onClick={() => navigate({ to: `/student/hp-system/${versionId}/${enrollment.cohortName || 'default'}/activities` })}>
                  <Activity className="w-4 h-4 text-blue-500" />
                </Button>
              )}
              {isTimeslotActive && (
                <Button variant="outline" size="icon" title="Timeslot" onClick={() => setIsTimeslotModalOpen(true)}>
                  <Clock className="w-4 h-4 text-green-500" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const CourseCardSkeleton = ({ variant }: { variant: string }) => {
  if (variant === 'dashboard' || variant === 'available') {
    return (
      <Card className="flex flex-col gap-0 py-0 bg-white dark:bg-card shadow-sm border-0 rounded-[24px] overflow-hidden animate-pulse">
        <div className="bg-slate-100 dark:bg-slate-800 w-full aspect-video" />
        <CardContent className="p-4">
          <Skeleton className="mb-2.5 w-20 h-4" />
          <Skeleton className="mb-2 w-full h-6" />
          <Skeleton className="mb-3 w-3/4 h-4" />
          <div className="space-y-2 mb-4">
            <Skeleton className="w-full h-2" />
            <Skeleton className="w-full h-2" />
          </div>
          <Skeleton className="rounded-xl w-full h-10" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="w-48 h-6" />
            <Skeleton className="w-32 h-4" />
          </div>
          <Skeleton className="w-24 h-6" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="w-full h-2" />
        <div className="flex justify-between">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-32 h-4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-10" />
          <Skeleton className="w-10 h-10" />
          <Skeleton className="w-10 h-10" />
        </div>
      </CardContent>
    </Card>
  );
};

const LeaderboardDialog = ({ courseId, versionId, courseName, isOpen, cohortId }: { courseId: string; versionId: string; courseName?: string; isOpen: boolean; cohortId?: string }) => {
  const [page, setPage] = useState(1);
  const { finishers, active, totalPages, activeTotal, isLoading, error, myStats } = useLeaderboard(courseId, versionId, page, 100, isOpen, cohortId);

  return (
    <DialogContent className="flex flex-col max-w-4xl h-[85vh] overflow-hidden">
      <DialogHeader className="flex-shrink-0 pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          {courseName || 'Course'} Leaderboard
        </DialogTitle>
        <p className="text-muted-foreground text-sm">
          Finishers ranked by how fast they completed; active learners by effort in the last 7 days.
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="pr-4 h-full">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-12" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-muted-foreground text-center">{error}</p>
          ) : finishers.length === 0 && active.length === 0 ? (
            <p className="py-8 text-muted-foreground text-center">No leaderboard data available.</p>
          ) : (
            <LeaderboardLeagues finishers={finishers} active={active} myId={myStats?.userId} />
          )}
        </ScrollArea>
      </div>

      <div className="flex flex-shrink-0 justify-between items-center bg-background pt-4 border-border/50 border-t">
        {myStats ? (
          <div className="flex items-center gap-6 bg-primary/5 px-4 py-3 border border-primary/10 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">Your Rank</span>
              <span className="font-bold text-yellow-500 text-xl">#{myStats.rank}</span>
            </div>
            <div className="bg-border/50 w-px h-6" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                {myStats.league === "finishers" ? "Finished in" : "This week"}
              </span>
              <Badge variant="outline" className="font-bold">
                {myStats.league === "finishers"
                  ? myStats.daysToComplete != null
                    ? `${myStats.daysToComplete} days`
                    : `${myStats.completionPercentage.toFixed(0)}%`
                  : `${myStats.weeklyItems ?? 0} items`}
              </Badge>
            </div>
          </div>
        ) : <div />}
        {(totalPages || 0) > 1 && (
          <Pagination currentPage={page} totalPages={totalPages || 1} totalDocuments={activeTotal || 0} onPageChange={setPage} />
        )}
      </div>
    </DialogContent>
  );
};
