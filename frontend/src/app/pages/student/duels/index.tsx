import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/openapi";
import { useAuthStore } from "@/store/auth-store";
import { useHpStudentCohorts, useHpStudents, useCourseVersionById } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/Pagination";
import { 
  Zap, Plus, Calendar, Clock, User, Link as LinkIcon, 
  Copy, Play, Trash2, Swords, Loader2, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function StudentDuelsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?._id || "";
  const [activeTab, setActiveTab] = useState("pending");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const limit = 10;

  // Matchmaking State
  const [isMatchmakingOpen, setIsMatchmakingOpen] = useState(false);
  const [selectedMatchmakingCohortId, setSelectedMatchmakingCohortId] = useState<string>("");
  const [selectedMatchmakingModuleId, setSelectedMatchmakingModuleId] = useState<string>("all");

  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [matchRadius, setMatchRadius] = useState(5);
  const [matchedDuelId, setMatchedDuelId] = useState<string | null>(null);
  const [isMatchTransition, setIsMatchTransition] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch pending & history duels
  const { 
    data: pendingDuels = [], 
    isLoading: loadingPending, 
    refetch: refetchPending 
  } = api.useQuery("get", "/duels/pending");

  const { 
    data: historyData, 
    isLoading: loadingHistory
  } = api.useQuery("get", "/duels/history", {
    params: { query: { page: historyPage, limit } }
  });

  const historyDuels = historyData?.data ?? [];
  const totalHistory = historyData?.total ?? 0;
  const totalHistoryPages = Math.ceil(totalHistory / limit);

  // 2. Load cohorts / active enrollments
  const { data: cohorts = [] } = useHpStudentCohorts();

  const activeMatchmakingCohort = useMemo(() => {
    return cohorts.find((c: any) => c.cohortId === selectedMatchmakingCohortId);
  }, [cohorts, selectedMatchmakingCohortId]);

  const { data: matchmakingCourseVersionData } = useCourseVersionById(
    activeMatchmakingCohort?.courseVersionId || "",
    !!activeMatchmakingCohort?.courseVersionId
  );

  const matchmakingModules = useMemo(() => {
    return (matchmakingCourseVersionData as any)?.modules || [];
  }, [matchmakingCourseVersionData]);

  const matchmakingQueueMutation = api.useMutation("post", "/duels/matchmaking/queue");
  const matchmakingLeaveMutation = api.useMutation("delete", "/duels/matchmaking/queue");
  const matchmakingStatusMutation = api.useMutation("get", "/duels/matchmaking/status");

  const stopTimers = () => {
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);
  };

  useEffect(() => {
    const resumeSearch = async () => {
      try {
        const res = await matchmakingStatusMutation.mutateAsync({});
        if (res && res.status === "WAITING") {
          setIsSearching(true);
          setElapsedSeconds(res.waitTimeSeconds || 0);
          setMatchRadius(res.searchRadiusPercentage || 5);
          startPollingMatchmaking();
        } else if (res && res.status === "MATCHED" && res.duelId) {
          navigate({ to: `/student/duels/${res.duelId}` });
          toast.success("Active match found! Re-entering...");
        }
      } catch (err) {
        // Ignore 404 or other errors (means no active queue entry)
      }
    };
    resumeSearch();

    return () => stopTimers();
  }, []);

  const startPollingMatchmaking = () => {
    searchTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const nextSec = prev + 1;
        if (nextSec < 15) setMatchRadius(5);
        else if (nextSec < 30) setMatchRadius(15);
        else if (nextSec < 60) setMatchRadius(30);
        else setMatchRadius(100);
        return nextSec;
      });
    }, 1000);

    statusPollTimerRef.current = setInterval(async () => {
      try {
        const res = await matchmakingStatusMutation.mutateAsync({});
        if (res && res.status === "MATCHED" && res.duelId) {
          stopTimers();
          setMatchedDuelId(res.duelId);
          setIsMatchTransition(true);

          setTimeout(() => {
            setIsSearching(false);
            setIsMatchTransition(false);
            navigate({ to: `/student/duels/${res.duelId}` });
            toast.success("Match found! Entering battle...");
          }, 3000);
        }
      } catch (err: any) {
        console.error("Error polling matchmaking status:", err);
      }
    }, 2000);
  };

  const handleStartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchmakingCohortId) {
      toast.error("Please select a course");
      return;
    }

    setIsMatchmakingOpen(false);
    setIsSearching(true);
    setElapsedSeconds(0);
    setMatchRadius(5);
    setMatchedDuelId(null);
    setIsMatchTransition(false);

    try {
      await matchmakingQueueMutation.mutateAsync({
        body: {
          courseId: activeMatchmakingCohort.courseId,
          moduleId: (selectedMatchmakingModuleId && selectedMatchmakingModuleId !== "all") ? selectedMatchmakingModuleId : undefined,
        }
      });
      startPollingMatchmaking();
    } catch (err: any) {
      toast.error(err.message || "Failed to join matchmaking queue");
      setIsSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    stopTimers();
    setIsSearching(false);
    setIsMatchTransition(false);
    try {
      await matchmakingLeaveMutation.mutateAsync({});
      toast.success("Matchmaking search cancelled.");
    } catch (err: any) {
      console.error("Failed to cancel search:", err);
    }
  };

  // Create duel state
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [matchType, setMatchType] = useState<"FRIEND" | "INVITE_LINK">("FRIEND");
  const [roundCount, setRoundCount] = useState<number>(5);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [scheduleForDate, setScheduleForDate] = useState<string>("");
  const [scheduleForTime, setScheduleForTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive course details for modules and students
  const activeCohort = useMemo(() => {
    return cohorts.find((c: any) => c.cohortId === selectedCohortId);
  }, [cohorts, selectedCohortId]);

  // Load modules for the selected course version
  const { data: courseVersionData } = useCourseVersionById(
    activeCohort?.courseVersionId || "",
    !!activeCohort?.courseVersionId
  );

  const modules = useMemo(() => {
    return (courseVersionData as any)?.modules || [];
  }, [courseVersionData]);

  // Load classmate list for selected cohort
  const { data: classmates = [] } = useHpStudents(
    activeCohort?.courseVersionId || "",
    activeCohort?.cohortId || "",
    { page: 1, limit: 100, search: "", status: "ALL" }
  );

  // Mutation to create a duel
  const createDuelMutation = api.useMutation("post", "/duels");

  // Mutation to cancel a pending duel
  const cancelDuelMutation = api.useMutation("post", "/duels/{id}/cancel");

  // Mutation to join a duel
  const joinDuelMutation = api.useMutation("post", "/duels/{id}/join");

  const handleCreateDuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCohortId) {
      toast.error("Please select a course");
      return;
    }

    let scheduledForStr: string | undefined = undefined;
    if (matchType === "FRIEND" && scheduleForDate && scheduleForTime) {
      const scheduledDate = new Date(`${scheduleForDate}T${scheduleForTime}`);
      if (scheduledDate.getTime() < Date.now() + 10 * 60 * 1000) {
        toast.error("Scheduled time must be at least 10 minutes in the future.");
        return;
      }
      scheduledForStr = scheduledDate.toISOString();
    }

    if (matchType === "FRIEND" && !targetUserId) {
      toast.error("Please select an opponent");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createDuelMutation.mutateAsync({
        body: {
          courseId: activeCohort.courseId,
          moduleId: (selectedModuleId && selectedModuleId !== "all") ? selectedModuleId : undefined,
          matchType,
          roundCount,
          targetUserId: matchType === "FRIEND" ? targetUserId : undefined,
          scheduledFor: scheduledForStr,
        }
      });

      toast.success("Duel challenge created successfully!");
      refetchPending();

      if (matchType === "INVITE_LINK" && res.inviteToken) {
        const link = `${window.location.origin}/student/duels/${res._id}?inviteToken=${res.inviteToken}`;
        setShareableUrl(link);
      } else {
        setIsCreateOpen(false);
        // Clear inputs
        setSelectedModuleId("all");
        setTargetUserId("");
        setScheduleForDate("");
        setScheduleForTime("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create duel challenge.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDuel = async (duelId: string) => {
    try {
      await cancelDuelMutation.mutateAsync({
        params: { path: { id: duelId } }
      });
      toast.success("Duel cancelled successfully");
      refetchPending();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel duel");
    }
  };

  const handleCheckIn = async (duelId: string) => {
    try {
      await joinDuelMutation.mutateAsync({
        params: { path: { id: duelId } }
      });
      toast.success("Checked in successfully! Navigating to battle...");
      navigate({ to: `/student/duels/${duelId}` });
    } catch (err: any) {
      toast.error(err.message || "Failed to check in");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Invite link copied to clipboard!");
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <Swords className="h-8 w-8 text-primary animate-pulse" />
            Spurti Duels
          </h1>
          <p className="text-muted-foreground mt-1">
            Challenge your classmates, test your knowledge, and earn extra HP points.
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => setIsMatchmakingOpen(true)} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md">
            <Swords className="h-4 w-4" /> Find a Match
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Challenge Someone
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="pending" className="gap-2">
            Active / Pending
            {pendingDuels.length > 0 && (
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {pendingDuels.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Challenge History</TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Challenges */}
        <TabsContent value="pending" className="mt-6">
          {loadingPending ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingDuels.length === 0 ? (
            <Card className="border-dashed flex flex-col justify-center items-center text-center p-12">
              <Swords className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">No Active challenges</CardTitle>
              <CardDescription className="max-w-[400px] mt-2">
                You don't have any pending challenges or ongoing duels. Start one by clicking "Challenge Someone"!
              </CardDescription>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingDuels.map((duel: any) => {
                const isCreator = duel.createdBy?.toString() === userId;
                const hasJoined = duel.players.some((p: any) => p.userId?.toString() === userId && p.joinedAt);
                const isScheduled = !!duel.scheduledFor;

                return (
                  <Card key={duel._id} className="relative overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-xs">
                          {duel.matchType === "FRIEND" ? "Friend Duel" : "Invite Link"}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={
                            duel.status === "IN_PROGRESS" ? "bg-green-500/20 text-green-500" :
                            duel.status === "READY" ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
                          }
                        >
                          {duel.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2 font-semibold">
                        {duel.matchType === "FRIEND" ? "Vs. Opponent" : "Open Battle"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-6">
                      <div className="text-sm space-y-2 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          <span>Rounds: {duel.roundCount}</span>
                        </div>

                        {isScheduled && (
                          <div className="flex items-center gap-2 text-primary font-medium">
                            <Clock className="h-4 w-4" />
                            <span>
                              Scheduled: {new Date(duel.scheduledFor).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {/* Play/Enter Duel Button */}
                        {duel.status === "IN_PROGRESS" && (
                          <Button asChild size="sm" className="w-full gap-2">
                            <Link to={`/student/duels/${duel._id}` as any}>
                              <Play className="h-4 w-4" /> Enter Duel
                            </Link>
                          </Button>
                        )}

                        {/* Check-In/Join Button (For scheduled or ready duels) */}
                        {((duel.status === "PENDING" || duel.status === "READY") && isScheduled && !hasJoined) && (
                          <Button size="sm" onClick={() => handleCheckIn(duel._id)} className="w-full gap-2 bg-amber-500 hover:bg-amber-600">
                            <Play className="h-4 w-4" /> Check In
                          </Button>
                        )}

                        {/* Polling / Waiting for Opponent */}
                        {duel.status === "PENDING" && !isScheduled && isCreator && (
                          <div className="w-full flex items-center justify-between gap-2">
                            {duel.matchType === "INVITE_LINK" && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 gap-1"
                                onClick={() => copyToClipboard(`${window.location.origin}/student/duels/${duel._id}?inviteToken=${duel.inviteToken}`)}
                              >
                                <Copy className="h-4 w-4" /> Copy Link
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" className="gap-2" onClick={() => handleCancelDuel(duel._id)}>
                              <Trash2 className="h-4 w-4" /> Cancel
                            </Button>
                          </div>
                        )}

                        {/* View/Poll Status for Joinees */}
                        {duel.status === "PENDING" && !isCreator && (
                          <Button asChild size="sm" variant="outline" className="w-full gap-2">
                            <Link to={`/student/duels/${duel._id}` as any}>
                              <ArrowRight className="h-4 w-4" /> View Lobby
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: History */}
        <TabsContent value="history" className="mt-6">
          {loadingHistory ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : historyDuels.length === 0 ? (
            <Card className="border-dashed flex flex-col justify-center items-center text-center p-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">No past duels</CardTitle>
              <CardDescription className="max-w-[400px] mt-2">
                You haven't completed any duels yet. Face your classmate today!
              </CardDescription>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match Mode</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>HP Points</TableHead>
                      <TableHead>Date Completed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyDuels.map((duel: any) => {
                      const isWinner = duel.winnerUserId?.toString() === userId;
                      const isDraw = duel.resolutionReason === "DRAW" || !duel.winnerUserId;
                      const outcome = isDraw ? "DRAW" : (isWinner ? "WIN" : "LOSS");

                      return (
                        <TableRow key={duel._id}>
                          <TableCell className="font-medium">
                            {duel.matchType === "FRIEND" ? "Friend Duel" : "Invite Link"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                outcome === "WIN" ? "bg-green-500/20 text-green-500 border-none" :
                                outcome === "LOSS" ? "bg-red-500/20 text-red-500 border-none" : "bg-slate-500/20 text-slate-500 border-none"
                              }
                              variant="outline"
                            >
                              {outcome}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium uppercase text-muted-foreground">
                            {duel.resolutionReason || "NORMAL"}
                          </TableCell>
                          <TableCell>
                            <span className={duel.pointsAwarded > 0 ? "text-green-500 font-semibold" : "text-muted-foreground"}>
                              {duel.pointsAwarded > 0 ? `+${duel.pointsAwarded} HP` : "0 HP"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(duel.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/student/duels/${duel._id}` as any}>Details</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalHistoryPages > 1 && (
                  <div className="p-4 flex justify-end">
                    <Pagination 
                      currentPage={historyPage} 
                      totalPages={totalHistoryPages} 
                      totalDocuments={totalHistory}
                      onPageChange={setHistoryPage} 
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Create Duel Challenge */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Challenge Classmate</DialogTitle>
            <DialogDescription>
              Select a course version, choose an opponent or generate an invite link, and battle.
            </DialogDescription>
          </DialogHeader>

          {shareableUrl ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Your Invite Link duel is ready! Send this URL to your classmate to let them join:
              </p>
              <div className="flex gap-2">
                <Input value={shareableUrl} readOnly className="flex-1 font-mono text-xs" />
                <Button size="icon" onClick={() => copyToClipboard(shareableUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter className="pt-4">
                <Button 
                  onClick={() => {
                    setShareableUrl(null);
                    setIsCreateOpen(false);
                  }}
                  className="w-full"
                >
                  Close & View Lobby
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateDuel} className="space-y-4 py-4">
              {/* Select Course / Cohort */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Enrolled Course</label>
                <Select value={selectedCohortId} onValueChange={(val) => {
                  setSelectedCohortId(val);
                  setSelectedModuleId("all");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort: any) => (
                      <SelectItem key={cohort.cohortId} value={cohort.cohortId}>
                        {cohort.cohortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Optional Module */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Optional Module</label>
                <Select value={selectedModuleId} onValueChange={setSelectedModuleId} disabled={!selectedCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Full course scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Full Course (All Modules)</SelectItem>
                    {modules.map((m: any) => (
                      <SelectItem key={m.moduleId || m._id} value={m.moduleId || m._id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Match Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Match Type Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    type="button" 
                    variant={matchType === "FRIEND" ? "default" : "outline"}
                    onClick={() => setMatchType("FRIEND")}
                    className="gap-2"
                  >
                    <User className="h-4 w-4" /> Friend Duel
                  </Button>
                  <Button 
                    type="button" 
                    variant={matchType === "INVITE_LINK" ? "default" : "outline"}
                    onClick={() => setMatchType("INVITE_LINK")}
                    className="gap-2"
                  >
                    <LinkIcon className="h-4 w-4" /> Invite Link
                  </Button>
                </div>
              </div>

              {/* Round Count */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Round Count</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 7, 9].map((count) => (
                    <Button 
                      key={count}
                      type="button"
                      variant={roundCount === count ? "default" : "outline"}
                      onClick={() => setRoundCount(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>

              {matchType === "FRIEND" && (
                <>
                  {/* Select Target Opponent Classmate */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Choose Classmate</label>
                    <Select value={targetUserId} onValueChange={setTargetUserId} disabled={!selectedCohortId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select opponent" />
                      </SelectTrigger>
                      <SelectContent>
                        {classmates
                          .filter((student: any) => student._id?.toString() !== userId)
                          .map((student: any) => (
                            <SelectItem key={student._id} value={student._id}>
                              {student.name} ({student.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date & Time Selection to Schedule */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Schedule for Later (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="date" 
                        value={scheduleForDate} 
                        onChange={(e) => setScheduleForDate(e.target.value)} 
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <Input 
                        type="time" 
                        value={scheduleForTime} 
                        onChange={(e) => setScheduleForTime(e.target.value)} 
                      />
                    </div>
                    {(scheduleForDate || scheduleForTime) && (
                      <p className="text-xs text-amber-500 font-medium">
                        Check-in window: 5 min before to 10 min after scheduled time. Walkover rules apply.
                      </p>
                    )}
                  </div>
                </>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !selectedCohortId}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Challenge
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Matchmaking Setup */}
      <Dialog open={isMatchmakingOpen} onOpenChange={setIsMatchmakingOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card text-card-foreground border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary animate-pulse" />
              Find a Match
            </DialogTitle>
            <DialogDescription>
              We'll pair you with a classmate at a similar stage of progress.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStartSearch} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Enrolled Course</label>
              <Select value={selectedMatchmakingCohortId} onValueChange={(val) => {
                setSelectedMatchmakingCohortId(val);
                setSelectedMatchmakingModuleId("all");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort: any) => (
                    <SelectItem key={cohort.cohortId} value={cohort.cohortId}>
                      {cohort.cohortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Optional Module</label>
              <Select value={selectedMatchmakingModuleId} onValueChange={setSelectedMatchmakingModuleId} disabled={!selectedMatchmakingCohortId}>
                <SelectTrigger>
                  <SelectValue placeholder="Full course scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Full Course (All Modules)</SelectItem>
                  {matchmakingModules.map((m: any) => (
                    <SelectItem key={m.moduleId || m._id} value={m.moduleId || m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsMatchmakingOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedMatchmakingCohortId} className="bg-purple-600 hover:bg-purple-700">
                Start Search
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Matchmaking Searching Overlay */}
      <Dialog open={isSearching} onOpenChange={() => { /* Lock closing by clicking outside */ }}>
        <DialogContent className="sm:max-w-[420px] bg-card text-card-foreground border border-border pointer-events-auto" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-6">
            <style>{`
              @keyframes progress-fill {
                from { width: 0%; }
                to { width: 100%; }
              }
              .animate-progress-fill {
                animation: progress-fill 3s linear forwards;
              }
            `}</style>

            {isMatchTransition ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping scale-150" />
                  <div className="h-16 w-16 bg-green-600 text-white rounded-full flex items-center justify-center animate-bounce shadow-lg">
                    <Swords className="h-8 w-8" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-green-500">Match Found!</h3>
                  <p className="text-muted-foreground font-medium">
                    Preparing your duel arena...
                  </p>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full animate-progress-fill" style={{ width: '0%' }} />
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/10 rounded-full animate-pulse scale-125" />
                  <div className="h-16 w-16 bg-purple-600/10 text-purple-500 rounded-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                </div>

                <div className="space-y-2 w-full">
                  <h3 className="text-xl font-bold text-foreground">Searching for Opponent...</h3>
                  <div className="text-3xl font-mono font-bold text-primary">
                    {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  <Badge variant="secondary" className="px-3 py-1 bg-purple-500/20 text-purple-600 font-semibold">
                    Search Radius: &plusmn;{matchRadius}%
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-4 min-h-[40px] px-2">
                    {elapsedSeconds < 15 && "Looking for someone at a similar point in the course..."}
                    {elapsedSeconds >= 15 && elapsedSeconds < 30 && "Expanding search to broader completion gaps..."}
                    {elapsedSeconds >= 30 && elapsedSeconds < 60 && "Expanding search further..."}
                    {elapsedSeconds >= 60 && "Matching with anyone available..."}
                  </p>
                </div>

                <Button variant="destructive" onClick={handleCancelSearch} className="w-full gap-2 mt-4">
                  <Trash2 className="h-4 w-4" /> Cancel Search
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
