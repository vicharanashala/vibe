import { Clock, Info, Play, Trophy, Headphones, MessageCircle, ExternalLink, Check, Copy, Mail, Activity, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCourseVersionById, useLeaderboard, useCheckTimeSlotAccessOnDemand } from "@/hooks/hooks";
import { toast } from "sonner";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { EnrollmentDetailsDialog } from "@/components/course/EnrollmentDetailsDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "../ui/Pagination";
import { LeaderboardLeagues } from "@/components/course/LeaderboardLeagues";

const StudentTimeslotModal = lazy(() =>
  import("@/components/course/StudentTimeslotModal").then(mod => ({
    default: mod.default
  }))
);

export const CourseListCard = ({ enrollment, index, isLoading: _isLoading, variant = 'dashboard', className }: CourseCardProps) => {
  if (!enrollment || !enrollment.courseId || !enrollment.courseVersionId) return null;

  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
  const cohortId = enrollment?.cohortId ? (typeof enrollment.cohortId === 'string' ? enrollment.cohortId : bufferToHex(enrollment.cohortId as any)) : "";

  const { data: courseVersionData } = useCourseVersionById(versionId, variant !== 'available', cohortId || undefined);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const { check: checkTimeSlotAccess } = useCheckTimeSlotAccessOnDemand();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isForumOpen, setIsForumOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const progress = Number(Math.min(enrollment.percentCompleted ?? 0, 100).toFixed(2));
  const hasAssignedTimeslot = Array.isArray(enrollment.assignedTimeSlot)
    ? enrollment.assignedTimeSlot.length > 0
    : !!enrollment.assignedTimeSlot;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;

  const GURU_SETU_VERSION_ID = "6981df886e100cfe04f9c4ae";
  const MERN_CASE_STUDY_ID = "692f030a945e82ec875e9116";
  const isNotGuruSetu = versionId !== GURU_SETU_VERSION_ID;
  const supportLink = (courseVersionData as any)?.supportLink;
  const supportEmail = enrollment.courseId === MERN_CASE_STUDY_ID ? "vibe-support@vicharanashala.zohodesk" : "internship-support@vicharanashala.zohodesk";

  const contentCounts = enrollment.contentCounts || {};
  const itemCounts = (contentCounts as any).itemCounts || {};
  const versionItemCounts = (courseVersionData as any)?.itemCounts || {};

  const videoCount = Number((contentCounts as any).videos ?? itemCounts.VIDEO ?? versionItemCounts.VIDEO ?? 0);
  const quizCount = Number((contentCounts as any).quizzes ?? itemCounts.QUIZ ?? versionItemCounts.QUIZ ?? 0);

  // Derived presentation data (UI only — no new data sources).
  const instructors = enrollment.course?.instructors;
  const instructorName = Array.isArray(instructors)
    ? instructors.map((i: any) => i?.name).filter(Boolean).join(', ')
    : '';
  const completedItems = Number(enrollment.completedItems ?? 0);
  const totalItems = Number(enrollment.contentCounts?.totalItems ?? 0);
  const hpSystem = !!(courseVersionData as any)?.hpSystem;
  const isMoreVideosSoon = enrollment.courseId === "6981df886e100cfe04f9c4ad";

  // Subtle icon-tile accent, varied by position for visual rhythm.
  const iconThemes = [
    "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  ];
  const iconTheme = iconThemes[index % iconThemes.length];

  const hasMenu = variant !== 'available' && isNotGuruSetu;

  const handleContinue = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (variant === 'available') {
      navigate({ to: "/student/course-registration/$versionId/{-$cohort}", params: { versionId, cohort: cohortId } });
      return;
    }
    // Time-slot ("commitment") gate at entry: only let the student in during a
    // booked window. The backend getItem gate is the safety net.
    const access = await checkTimeSlotAccess(courseId, versionId);
    if (!access.canAccess) {
      toast.error(access.message || "You can only access this course during your booked time slot.");
      return;
    }
    setCurrentCourse({
      courseId, versionId, moduleId: null, sectionId: null, itemId: null, watchItemId: null,
      cohortName: enrollment.cohortName || null, cohortId: enrollment.cohortId || null
    });
    navigate({ to: "/student/learn" });
  };

  return (
    <Card
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-300 ease-out sm:flex-row sm:items-center sm:gap-4",
        "bg-white border-neutral-200/80 hover:border-neutral-300 hover:shadow-md",
        "dark:bg-white/[0.03] dark:border-white/[0.07] dark:hover:bg-white/[0.05]",
        "ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
        className
      )}
    >
      {/* Icon tile */}
      <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", iconTheme)}>
        <BookOpen className="h-6 w-6" />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            className="truncate text-base font-bold leading-tight text-foreground sm:text-lg"
            title={enrollment?.course?.name || `Course ${index + 1}`}
          >
            {enrollment?.course?.name || `Course ${index + 1}`}
          </h3>
          {isCompleted && (
            <Badge className="border-0 bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">Completed</Badge>
          )}
          {enrollment.cohortName && (
            <Badge variant="outline" className="border-primary/20 text-primary text-[10px]">{enrollment.cohortName}</Badge>
          )}
        </div>

        {(instructorName || variant === 'available') && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            {instructorName || 'Discover and enroll'}
          </p>
        )}

        {variant !== 'available' ? (
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {isMoreVideosSoon
                  ? `${completedItems}/${totalItems} • More videos soon`
                  : totalItems > 0
                    ? `${completedItems} of ${totalItems} lessons`
                    : `${videoCount} Videos • ${quizCount} Quizzes`}
              </span>
              {!isMoreVideosSoon && <span className="font-semibold text-foreground tabular-nums">{progress.toFixed(0)}%</span>}
            </div>
            {!isMoreVideosSoon && <Progress value={progress} className="h-1.5" />}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {videoCount} Videos • {quizCount} Quizzes
          </p>
        )}
      </div>

      {/* Actions: prominent primary CTA + tidy overflow menu (keeps every action) */}
      <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-center">
        <Button
          onClick={handleContinue}
          className={cn(
            "h-9 flex-1 gap-1.5 rounded-xl font-bold transition-all duration-200 sm:flex-none",
            variant === 'available'
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : progress === 0
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {variant === 'available' ? 'Register' : progress === 0 ? 'Start' : isCompleted ? 'Review' : 'Continue'}
          <Play className="h-3.5 w-3.5 fill-current" />
        </Button>

        {hasMenu && (
          <>
            {/* Book Slot — kept labeled */}
            <Button
              variant="outline"
              onClick={() => setIsTimeslotModalOpen(true)}
              className="h-9 gap-1.5 rounded-xl font-semibold"
              title="Pick Slot"
            >
              <Clock className="h-4 w-4 text-green-500" />
              <span className="hidden sm:inline">Pick Slot</span>
            </Button>

            {/* Remaining actions as icon-only buttons */}
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsDetailsOpen(true)} title="Details" aria-label="Details">
              <Info className="h-4 w-4 text-blue-500" />
            </Button>
            {hpSystem && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate({ to: `/student/hp-system/${versionId}/${enrollment.cohortName || 'default'}/activities` })} title="HP System" aria-label="HP System">
                <Activity className="h-4 w-4 text-blue-500" />
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsLeaderboardOpen(true)} title="Leaderboard" aria-label="Leaderboard">
              <Trophy className="h-4 w-4 text-yellow-500" />
            </Button>
            {supportLink && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" asChild title="Support" aria-label="Support">
                <a
                  href={supportLink.startsWith('mailto:') || supportLink.includes('@') ? (supportLink.startsWith('mailto:') ? supportLink : `mailto:${supportLink}`) : supportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Headphones className="h-4 w-4 text-indigo-500" />
                </a>
              </Button>
            )}
            {enrollment.courseId === MERN_CASE_STUDY_ID && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsForumOpen(true)} title="Forum" aria-label="Forum">
                <MessageCircle className="h-4 w-4 text-blue-500" />
              </Button>
            )}
            {!supportLink && (enrollment.courseId === "6943b2cafa4e840eb39490b6" || enrollment.courseId === MERN_CASE_STUDY_ID) && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsSupportOpen(true)} title="Support" aria-label="Support">
                <Mail className="h-4 w-4 text-indigo-500" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Controlled dialogs / modals — mounted here, opened from the menu. */}
      <EnrollmentDetailsDialog isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} enrollment={enrollment} />
      <Suspense fallback={null}>
        <StudentTimeslotModal
          isOpen={isTimeslotModalOpen}
          onClose={() => setIsTimeslotModalOpen(false)}
          courseId={courseId}
          courseVersionId={versionId}
          currentUserId={""}
          hasAssignedTimeslot={!!hasAssignedTimeslot}
        />
      </Suspense>

      {hasMenu && (
        <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
          <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} cohortId={cohortId} />
        </Dialog>
      )}

      {enrollment.courseId === MERN_CASE_STUDY_ID && (
        <Dialog open={isForumOpen} onOpenChange={setIsForumOpen}>
          <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
            <DialogHeader><DialogTitle>Discussion Forum</DialogTitle></DialogHeader>
            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Discord Community</h3>
                </div>
                <div className="rounded-xl border bg-primary/5 p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">Join our exclusive Discord community to connect with peers and mentors.</p>
                  <div className="flex gap-2">
                    <Button className="flex-1" asChild>
                      <a href="https://discord.gg/kKNBu3PF" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Join Discord
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText("https://discord.gg/kKNBu3PF"); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {!supportLink && (enrollment.courseId === "6943b2cafa4e840eb39490b6" || enrollment.courseId === MERN_CASE_STUDY_ID) && (
        <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Contact Support</DialogTitle></DialogHeader>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Mail className="w-6 h-6" /></div>
                <div>
                  <p className="font-semibold">Email us at</p>
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">{supportEmail}</a>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

// Internal Leaderboard Dialog
const LeaderboardDialog = ({ courseId, versionId, courseName, isOpen, cohortId }: { courseId: string; versionId: string; courseName?: string, isOpen: boolean, cohortId?: string }) => {
  const [page, setPage] = useState(1);
  const { finishers, active, totalPages, activeTotal, isLoading, error, myStats } = useLeaderboard(courseId, versionId, page, 100, isOpen, cohortId);

  return (
    <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
      <DialogHeader className="flex-shrink-0 pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          {courseName || 'Course'} Leaderboard
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Finishers ranked by how fast they completed; active learners by effort in the last 7 days.
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
          ) : finishers.length === 0 && active.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No leaderboard data available.</p>
          ) : (
            <LeaderboardLeagues finishers={finishers} active={active} myId={myStats?.userId} />
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
            <div className="w-px h-6 bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
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
