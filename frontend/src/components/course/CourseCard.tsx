// @ts-nocheck

import { Clock, Trophy, Medal, Crown, Info, ExternalLink, Copy, MessageCircle, Users, Check, Sparkles, Play, Activity, Award, Shield as LucideShield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, useCourseVersionById } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState, lazy, useEffect } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { StudentPolicyModal } from "@/app/pages/student/components/policies/StudentPolicyModal";


import { EnrollmentDetailsDialog } from "@/components/course/EnrollmentDetailsDialog";

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
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes since midnight

  const [fromHours, fromMinutes] = timeSlot.from.split(':').map(Number);
  const [toHours, toMinutes] = timeSlot.to.split(':').map(Number);
  const fromTime = fromHours * 60 + fromMinutes;
  const toTime = toHours * 60 + toMinutes;

  return currentTime >= fromTime && currentTime <= toTime;
};

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
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  // const [showPolicies, setShowPolicies] = useState(false);
  const supportEmail =
    enrollment.courseId === "692f030a945e82ec875e9116"
      ? "vibe-support@vicharanashala.zohodesk"
      : "internship-support@vicharanashala.zohodesk";

  // const progress = Math.round(enrollment.percentCompleted || 0) as number 
  const progress = Number(Math.min(enrollment.percentCompleted ?? 0, 100).toFixed(2));

  const hasAssignedTimeslot = enrollment.assignedTimeSlot &&
    Array.isArray(enrollment.assignedTimeSlot) &&
    enrollment.assignedTimeSlot.length > 0;

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

  const handleContinue = () => {
    if (variant === 'available') {
      navigate({
        to: "/student/course-registration/$versionId/{-$cohort}",
        params: { versionId: versionId, cohort: cohortId }
      });
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
      { bg: "bg-[#F3E8FF]", icon: "text-[#A855F7]", progress: "bg-[#A855F7]", iconComponent: <Play className="h-10 w-10 md:h-12 md:w-12" /> },
      { bg: "bg-[#DBEAFE]", icon: "text-[#3B82F6]", progress: "bg-[#3B82F6]", iconComponent: <Activity className="h-10 w-10 md:h-12 md:w-12" /> },
      { bg: "bg-[#FCE7F3]", icon: "text-[#EC4899]", progress: "bg-[#EC4899]", iconComponent: <Users className="h-10 w-10 md:h-12 md:w-12" /> },
    ];
    const theme = themes[index % themes.length];

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
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant="secondary" className="bg-[#F1F5F9] text-[#64748B] dark:bg-slate-800 dark:text-slate-400 border-0 font-medium px-3">Course</Badge>
                  {enrollment.cohortName && (
                    <Badge variant="outline" className="border-primary/30 text-primary dark:bg-primary/10 dark:text-blue-400 dark:border-blue-400/30 font-medium px-3">
                      {enrollment.cohortName}
                    </Badge>
                  )}
                  {isCompleted && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 font-medium">Completed</Badge>}
                </div>

                <h3
                  className="font-bold text-xl text-foreground mb-1 line-clamp-2 leading-tight break-words min-h-[3.25rem]"
                  title={enrollment?.course?.name || `Course ${index + 1}`}
                >
                  {enrollment?.course?.name || `Course ${index + 1}`}
                </h3>
                <p
                  className="text-sm text-muted-foreground mb-6 line-clamp-1 break-words min-h-[1.25rem]"
                  title={enrollment?.course?.description || "Accelerate your learning journey"}
                >
                  {enrollment?.course?.description || "Accelerate your learning journey"}
                </p>

                <div className="space-y-4">
                  {variant !== 'available' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm font-semibold">

                        {enrollment.courseId !== "6981df886e100cfe04f9c4ad" && <> <span className="text-muted-foreground">Completion Percentage</span><span className="text-foreground">{progress.toFixed(0)}%</span></>}
                      </div>

                      {enrollment.courseId !== "6981df886e100cfe04f9c4ad" ? (<div className="h-2 w-full bg-[#F1F5F9] dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", theme.progress)} style={{ width: `${progress}%` }} />
                      </div>) : (<div className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{enrollment.completedItems}/{enrollment.contentCounts?.totalItems} (More videos soon)</span>
                      </div>)}

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

                    {variant !== 'available' && isNotGuruSetu && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 text-[10px] lg:text-xs font-bold rounded-lg border-2"
                          onClick={(e) => { e.stopPropagation(); setShowPolicies(true); }}
                        >
                          <LucideShield className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                          Policies
                        </Button>
                        {supportLink && (
                          <div onClick={(e) => e.stopPropagation()} className="flex-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full h-9 text-[10px] lg:text-xs font-bold rounded-lg border-2">
                                  <MessageCircle className="h-3.5 w-3.5 mr-1 text-blue-500" />
                                  Forum
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="w-full max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Forum Details</DialogTitle>
                                </DialogHeader>
                                <Separator className="my-4" />
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                      <MessageCircle className="w-4 h-4 text-primary-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold">Discord Community</h3>
                                    <Sparkles className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="rounded-xl border bg-primary/5 p-6 space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-md">
                                          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-base">Join Our Community</p>
                                          <p className="text-sm text-muted-foreground">Connect with fellow students</p>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      Get help, share resources, and connect with your coursemates in our exclusive Discord server.
                                    </p>
                                    <div className="flex items-center gap-2.5 pt-1">
                                      <Button asChild className="flex-1">
                                        <a href={supportLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
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
                                      <div className={cn("text-xs px-3 py-2 rounded-lg border flex items-center gap-2", copied ? "text-primary bg-primary/10 border-primary/20" : "text-red-500 bg-red-50 border-red-100")}>
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
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Back Side - Stretches to match front height */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white dark:bg-slate-900 rounded-[24px] p-6 border-2 border-primary/20 shadow-xl flex flex-col cursor-pointer" onClick={() => setIsFlipped(false)}>
            <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
              <div className="flex items-center justify-between mb-4">
                <Badge className={cn("font-bold px-3 py-1", theme.bg, theme.icon.replace('text-', 'bg-').replace(/\[/g, '').replace(/\]/g, '/10'))}>
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
                  {enrollment.cohortName && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Cohort</span>
                      <span className="text-foreground font-bold truncate max-w-[120px]">{enrollment.cohortName}</span>
                    </div>
                  )}
                  {/* Detailed Counts */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Total Items</span>
                      <span className="text-foreground font-bold">{totalLessons}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Modules</span>
                      <span className="text-foreground font-bold">{moduleCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Sections</span>
                      <span className="text-foreground font-bold">{sectionCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Videos</span>
                      <span className="text-foreground font-bold">{videoCount}</span>
                    </div>
                    {quizCount > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Quizzes</span>
                        <span className="text-foreground font-bold">{quizCount}</span>
                      </div>
                    )}
                    {articleCount > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Articles</span>
                        <span className="text-foreground font-bold">{articleCount}</span>
                      </div>
                    )}
                    {projectCount > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Projects</span>
                        <span className="text-foreground font-bold">{projectCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Timeslot Info */}
                  <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-slate-50 dark:border-slate-800/50">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Timeslot
                    </span>
                    <span className={cn(
                      "font-bold truncate max-w-[140px]",
                      timeSlot ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}>
                      {timeslotStr}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className={cn("grid gap-3", isTimeslotActive ? "grid-cols-2" : "grid-cols-1")} onClick={(e) => e.stopPropagation()}>
                {variant !== 'available' && (
                  <>
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
                  </>
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
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
               <span>{progress.toFixed(2)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{completedLessons} / {totalLessons} Lessons</span>
            </div>
            {enrollment.enrollmentDate && (
              <div className="flex items-center gap-2">
                <Medal className="h-4 w-4" />
                <span>Enrolled {new Date(enrollment.enrollmentDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleContinue} className="flex-1" disabled={!isCurrentTimeInTimeSlot(enrollment.assignedTimeSlot)}>
              {isStart ? 'Start Course' : 'Continue Learning'}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              {isRankVisible && (
                <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Leaderboard">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                    </Button>
                  </DialogTrigger>
                  <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} cohortId={cohortId} />
                </Dialog>
              )}
              {isHpSystem && (
                <Button variant="outline" size="icon" title="HP System" onClick={() => navigate({ to: `/student/hp-system/${versionId}/${enrollment.cohortName || 'default'}/activities` })}>
                  <Activity className="h-4 w-4 text-blue-500" />
                </Button>
              )}
              {isTimeslotActive && (
                <Button variant="outline" size="icon" title="Timeslot" onClick={() => setIsTimeslotModalOpen(true)}>
                  <Clock className="h-4 w-4 text-green-500" />
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
      <Card className="border-0 bg-white dark:bg-card overflow-hidden flex flex-col rounded-[24px] shadow-sm animate-pulse">
        <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800" />
        <CardContent className="p-6">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-6" />
          <div className="space-y-2 mb-6">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </CardContent>
    </Card>
  );
};

const LeaderboardDialog = ({ courseId, versionId, courseName, isOpen, cohortId }: { courseId: string; versionId: string; courseName?: string; isOpen: boolean; cohortId?: string }) => {
  const [page, setPage] = useState(1);
  const { leaderboard, totalPages, totalDocuments, isLoading, error, myStats } = useLeaderboard(courseId, versionId, page, 10, isOpen, cohortId);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
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
    <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
      <DialogHeader className="flex-shrink-0 pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          {courseName || 'Course'} Leaderboard
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Students ranked by completion percentage and performance.
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-muted-foreground text-center py-8">{error}</p>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No leaderboard data available.</p>
          ) : (
            <div className="space-y-2 pb-4">
              {leaderboard.map((entry) => {
                const rankStyle = getRankStyle(entry.rank);
                return (
                  <div key={entry.userId} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors border-2",
                    entry.rank === 1 ? "bg-yellow-400/10 border-yellow-400/30 shadow-sm" :
                    entry.rank === 2 ? "bg-gray-400/10 border-gray-400/30" :
                    entry.rank === 3 ? "bg-orange-400/10 border-orange-400/30" :
                    "bg-muted/20 border-transparent hover:bg-muted/30"
                  )}>
                    <div className="flex-shrink-0 w-10 text-center">
                      {entry.rank <= 3 ? (
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mx-auto", rankStyle.bgColor)}>
                          <span className={cn("font-bold text-sm", rankStyle.textColor)}>{entry.rank}</span>
                        </div>
                      ) : (
                        <span className="text-base font-semibold text-muted-foreground">{entry.rank}</span>
                      )}
                    </div>
                    <Avatar className="h-10 w-10 border border-white dark:border-slate-800 shadow-sm">
                      <AvatarFallback>{getInitials(entry.userName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-sm flex items-center gap-2">
                        {entry.userName}
                        {entry.rank === 1 && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                      </p>
                      <div className="text-xs truncate">
                        {Math.round(entry.completionPercentage) === 100 ? (
                          <>
                            <span className="text-green-600 font-medium">✓ Completed</span>
                            {entry.completedAt && (
                              <span className="ml-1 opacity-60 text-[10px]">on {new Date(entry.completedAt).toLocaleDateString()}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">In Progress: {entry.completionPercentage.toFixed(2)}%</span>
                        )}
                        {/* <span className="mx-1.5 opacity-20">|</span> */}
                        {/* <span className="opacity-70">{entry.completedCount || 0} Lessons &bull; {entry.score || 0} XP</span> */}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={entry.completionPercentage === 100 ? "default" : "secondary"} className="font-bold text-[10px] min-w-[45px] justify-center">
                        {Math.round(entry.completionPercentage)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-shrink-0 pt-4 border-t border-border/50 bg-background flex items-center justify-between">
        {myStats ? (
          <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Your Rank</span>
              <span className="font-bold text-xl text-yellow-500">#{myStats.rank}</span>
            </div>
            {/* <div className="w-px h-6 bg-border/50" /> */}
            {/* <div className="flex items-center gap-2"> */}
              {/* <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Stats</span> */}
              {/* <span className="font-semibold text-sm">{myStats.completedCount || 0} Lessons &bull; {myStats.score || 0} XP</span> */}
            {/* </div> */}
            <div className="w-px h-6 bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Progress</span>
              <Badge variant="outline" className="font-bold">{myStats.completionPercentage.toFixed(2)}%</Badge>
            </div>
          </div>
        ) : <div />}
        {(totalPages || 0) > 1 && (
          <Pagination currentPage={page} totalPages={totalPages || 1} totalDocuments={totalDocuments || 0} onPageChange={setPage} />
        )}
      </div>
    </DialogContent>
  );
};
