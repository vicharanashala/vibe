import { Clock, Info, Play, Trophy, Headphones, MessageCircle, ExternalLink, Users, Sparkles, Check, Copy, Crown, Medal, Award, LifeBuoy, Mail, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCourseVersionById, useLeaderboard } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense, useEffect } from "react";
import { bufferToHex } from "@/utils/helpers";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from '@/types/course.types';
import { EnrollmentDetailsDialog } from "@/components/course/EnrollmentDetailsDialog";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pagination } from "../ui/Pagination";

const StudentTimeslotModal = lazy(() =>
  import("@/components/course/StudentTimeslotModal").then(mod => ({
    default: mod.default
  }))
);

const isCurrentTimeInTimeSlot = (timeSlotData?: any) => {
  if (!timeSlotData) return true;
  const timeSlot = Array.isArray(timeSlotData) ? timeSlotData[0] : timeSlotData;
  if (!timeSlot || !timeSlot.from || !timeSlot.to) return true;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [fromHours, fromMinutes] = timeSlot.from.split(':').map(Number);
  const [toHours, toMinutes] = timeSlot.to.split(':').map(Number);
  const fromTime = fromHours * 60 + fromMinutes;
  const toTime = toHours * 60 + toMinutes;

  return currentTime >= fromTime && currentTime <= toTime;
};

export const CourseListCard = ({ enrollment, index, isLoading: _isLoading, variant = 'dashboard', className, completion, setCompletion }: CourseCardProps) => {
  if (!enrollment || !enrollment.courseId || !enrollment.courseVersionId) return null;

  const courseId = bufferToHex(enrollment.courseId as string);
  const versionId = bufferToHex(enrollment.courseVersionId as string) || "";
  const cohortId = enrollment?.cohortId ? (typeof enrollment.cohortId === 'string' ? enrollment.cohortId : bufferToHex(enrollment.cohortId as any)) : "";
  const module_number = enrollment.moduleNumber || "";
  const section_number = enrollment.sectionNumber || "";
  const item_type = enrollment.itemType || "VIDEO";

  const { data: courseVersionData } = useCourseVersionById(versionId, variant !== 'available', cohortId || undefined);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTimeslotModalOpen, setIsTimeslotModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isForumOpen, setIsForumOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const progress = Number(Math.min(enrollment.percentCompleted ?? 0, 100).toFixed(2));
  const hasAssignedTimeslot = enrollment.assignedTimeSlot && Array.isArray(enrollment.assignedTimeSlot) && enrollment.assignedTimeSlot.length > 0;
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

  useEffect(() => {
    if (variant === 'available') return;
    const existingCompletionIndex = completion?.findIndex((c) => c.courseVersionId === versionId);
    if (existingCompletionIndex === -1 && enrollment) {
      setCompletion?.([
        ...(completion || []),
        {
          courseVersionId: versionId,
          percentage: typeof progress === 'number' ? progress : 0,
          totalItems: typeof contentCounts.totalItems === 'number' ? contentCounts.totalItems : 0,
          completedItems: typeof enrollment.completedItems === 'number' ? enrollment.completedItems : 0
        },
      ]);
    }
  }, [completion, versionId, enrollment, progress, contentCounts.totalItems, variant, setCompletion]);

  const handleContinue = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (variant === 'available') {
      navigate({ to: "/student/course-registration/$versionId/{-$cohort}", params: { versionId, cohort: cohortId } });
      return;
    }
    setCurrentCourse({
      courseId, versionId, moduleId: null, sectionId: null, itemId: null, watchItemId: null,
      cohortName: enrollment.cohortName || null, cohortId: enrollment.cohortId || null
    });
    navigate({ to: "/student/learn" });
  };

  const SendToCourse = () => {
    if (variant === 'available') return;

    const target = {
      courseId,
      versionId,
      cohortId,
      tab: isCompleted ? "completed" : "enrolled",
    };

    if (typeof window !== "undefined" && window.location.pathname === "/student/courses") {
      window.dispatchEvent(new CustomEvent("student-course-progress-open", { detail: target }));
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("student-course-progress-dialog-target", JSON.stringify(target));
    }

    navigate({ to: "/student/courses" });
  };


  return (
    <Card
      className={cn("dark:bg-[#4b341e4b] border border-border overflow-hidden flex flex-col sm:flex-row student-card-hover p-0", className)}
    >
      <div className="w-full h-40 sm:h-auto sm:w-32 flex-shrink-0 flex items-center justify-center">
        <ImageWithFallback
          src="https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6"
          alt={enrollment?.course?.name || `Course ${index + 1}`}
          aspectRatio="aspect-square"
          className="w-full h-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
        />
      </div>

      <CardContent className="p-4 sm:pl-3 flex flex-col flex-1">
        <div className="flex items-start justify-between xl:flex-row flex-col gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-secondary/70 text-secondary-foreground border-0 font-normal">Course</Badge>
            {isCompleted && <Badge className="bg-green-100 text-green-800 border-0 font-normal">Completed</Badge>}
            {enrollment.cohortName && <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">{enrollment.cohortName}</Badge>}
          </div>

          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 min-w-fit">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    <p>This course is actively updated with new content.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span>Ongoing training</span>
            </div>

            {variant !== 'available' && (
              <div className="flex items-center gap-2">
                <span>Progress</span>
                <div className="flex items-center gap-2">
                  {enrollment.courseId !== "6981df886e100cfe04f9c4ad" ?  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                  </div> : (<span>{enrollment.completedItems}/{enrollment.contentCounts?.totalItems} (More videos soon)</span>)}
                  {enrollment.courseId !== "6981df886e100cfe04f9c4ad" && <span>{progress.toFixed(2)}%</span>}
                </div>
              </div>
            )}

            {variant !== 'available' && enrollment.enrollmentDate && (
              <div className="flex items-center gap-1.5">
                <span>Enrolled At</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-500">{new Date(enrollment.enrollmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <h3 className="font-bold text-lg mb-1 leading-tight text-foreground">{enrollment?.course?.name || `Course ${index + 1}`}</h3>

        <p className="text-xs text-muted-foreground mb-4">
          {variant === 'available' ? 'Discover and enroll' : isCompleted ? 'Course completed!' : progress === 0 ? 'Start your learning journey' : 'Continue Learning'}
          {variant !== 'available' && !isCompleted && progress !== 0 && (
            <span className="ml-2">&bull; MOD {module_number} &bull; SEC {section_number} &bull; {item_type}</span>
          )}
          &nbsp;&nbsp;&bull; {videoCount} Videos &bull; {quizCount} Quizzes
        </p>

        <div className="mt-auto flex flex-col sm:flex-row gap-2">
          <Button
            className={cn("w-full sm:w-auto h-9 rounded-xl font-bold transition-all duration-200", variant === 'available' ? "bg-primary text-primary-foreground" : progress === 0 ? "bg-green-600 hover:bg-green-700 text-white shadow-md border-0" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md")}
            onClick={handleContinue}
            disabled={!isCurrentTimeInTimeSlot(enrollment.assignedTimeSlot)}
          >
            {variant === 'available' ? 'Register' : progress === 0 ? 'Start' : isCompleted ? 'Completed' : 'Continue'}
            <Play className="h-3.5 w-3.5 ml-2 fill-current" />
          </Button>

          {variant !== 'available' && isNotGuruSetu && (
            <>
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold" onClick={SendToCourse}>
                <Activity className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Progress
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold" onClick={() => setIsDetailsOpen(true)}>
                <Info className="h-3.5 w-3.5 mr-1.5 text-blue-500" /> Details
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold" onClick={() => setIsTimeslotModalOpen(true)}>
                <Clock className="h-3.5 w-3.5 mr-1.5 text-green-500" /> {hasAssignedTimeslot ? 'Slot' : 'Pick Slot'}
              </Button>
              <Dialog open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold">
                    <Trophy className="h-3.5 w-3.5 mr-1.5 text-yellow-500" /> Rank
                  </Button>
                </DialogTrigger>
                <LeaderboardDialog courseId={courseId} versionId={versionId} courseName={enrollment?.course?.name} isOpen={isLeaderboardOpen} cohortId={cohortId} />
              </Dialog>
              
              {supportLink && (
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold" asChild>
                  <a href={supportLink.startsWith('mailto:') || supportLink.includes('@') ? (supportLink.startsWith('mailto:') ? supportLink : `mailto:${supportLink}`) : supportLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                    <Headphones className="h-3.5 w-3.5 text-indigo-500" /> Support
                  </a>
                </Button>
              )}
              {enrollment.courseId === MERN_CASE_STUDY_ID && (
                <Dialog open={isForumOpen} onOpenChange={setIsForumOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold">Forum</Button>
                  </DialogTrigger>
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
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold">Support</Button>
                  </DialogTrigger>
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
            </>
          )}
        </div>
      </CardContent>

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
    </Card>
  );
};

// Internal Leaderboard Dialog
const LeaderboardDialog = ({ courseId, versionId, courseName, isOpen, cohortId }: { courseId: string; versionId: string; courseName?: string, isOpen: boolean, cohortId?: string }) => {
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
