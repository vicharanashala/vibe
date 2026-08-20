import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { api } from "@/lib/openapi";
import { useAuthStore } from "@/store/auth-store";
import { useQuestionById, useHpStudentCohorts } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Swords, Swords as SwordsIcon, Trophy, XCircle, AlertCircle, 
  Clock, ArrowLeft, Loader2, User, HelpCircle, Play
} from "lucide-react";
import { toast } from "sonner";

export default function ActiveDuelPage() {
  const { id: duelId } = useParams({ strict: false });
  const { user } = useAuthStore();
  const userId = user?._id || "";

  // 1. Poll Duel State (every 2 seconds)
  const { 
    data: duel, 
    isLoading: loadingDuel, 
    error: duelError,
    refetch: refetchDuel 
  } = api.useQuery("get", "/duels/{id}", {
    params: { path: { id: duelId || "" } }
  }, {
    refetchInterval: 2000,
    enabled: !!duelId
  });

  // 2. Fetch Cohorts to resolve course name
  const { data: cohorts = [] } = useHpStudentCohorts();

  const courseName = useMemo(() => {
    if (!duel) return "Course Duel";
    return cohorts.find((c: any) => c.courseId === duel.courseId)?.cohortName || "Course Duel";
  }, [duel, cohorts]);

  // 3. Find the current active round for the current user
  const currentRound = useMemo(() => {
    if (!duel || !duel.rounds || duel.rounds.length === 0) return null;
    
    // Find the first round that has not been resolved/completed yet
    const active = duel.rounds.find(r => r.winnerUserId === undefined);

    return active || duel.rounds[duel.rounds.length - 1];
  }, [duel]);

  const hasSubmittedCurrentRound = useMemo(() => {
    if (!currentRound) return false;
    return currentRound.submissions?.some(s => s.userId?.toString() === userId?.toString()) || false;
  }, [currentRound, userId]);

  // 4. Fetch the active question detail
  const { 
    data: question, 
    isLoading: loadingQuestion 
  } = useQuestionById(
    currentRound && duel?.status === "IN_PROGRESS" && !hasSubmittedCurrentRound ? currentRound.questionId : ""
  );

  // Time tracking for responseTimeMs
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Set timer when question is loaded
  useEffect(() => {
    if (question && !hasSubmittedCurrentRound) {
      setQuestionStartTime(Date.now());
      setSelectedOptionId("");
      setTimeLeft(question.timeLimitSeconds || 30);
    }
  }, [question, hasSubmittedCurrentRound, currentRound?.roundNumber]);

  // Countdown timer logic
  useEffect(() => {
    if (!question || hasSubmittedCurrentRound || !question.timeLimitSeconds) return;

    setTimeLeft(question.timeLimitSeconds);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [question, hasSubmittedCurrentRound, currentRound?.roundNumber]);

  // Combine and shuffle choices safely
  const options = useMemo(() => {
    if (!question) return [];
    
    const stringifyId = (id: any): string => {
      if (!id) return "";
      if (typeof id === "string") return id;
      if (typeof id === "object") {
        if (id.$oid) return id.$oid;
        if (id.buffer && id.buffer.data && Array.isArray(id.buffer.data)) {
          return Array.from(id.buffer.data)
            .map((b: any) => b.toString(16).padStart(2, "0"))
            .join("");
        }
        if (id.toString && typeof id.toString === "function") {
          const str = id.toString();
          if (str && str !== "[object Object]") return str;
        }
      }
      return String(id);
    };

    // Case A: Rendered view has lotItems array
    if ((question as any).lotItems && Array.isArray((question as any).lotItems)) {
      return (question as any).lotItems.map((item: any) => ({
        ...item,
        _id: stringifyId(item._id)
      }));
    }
    
    // Case B: Raw schema fallback
    const list: any[] = [];
    if (question.correctLotItem) {
      list.push({
        _id: stringifyId((question.correctLotItem as any)._id) || "correct",
        text: question.correctLotItem.text,
        explaination: question.correctLotItem.explaination
      });
    }
    if (question.incorrectLotItems && Array.isArray(question.incorrectLotItems)) {
      question.incorrectLotItems.forEach((item: any, idx: number) => {
        list.push({
          _id: stringifyId(item._id) || `incorrect_${idx}`,
          text: item.text,
          explaination: item.explaination
        });
      });
    }
    return list.sort(() => Math.random() - 0.5);
  }, [question]);

  // Mutations
  const joinMutation = api.useMutation("post", "/duels/{id}/join");
  const submitAnswerMutation = api.useMutation("post", "/duels/{id}/rounds/{roundNumber}/answer");

  const handleCheckIn = async () => {
    if (!duelId) return;
    setIsCheckingIn(true);
    try {
      // Find query parameters for inviteToken
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("inviteToken") || undefined;

      await joinMutation.mutateAsync({
        params: { path: { id: duelId } },
        body: { inviteToken }
      });
      toast.success("Checked in successfully! Battle starting soon...");
      refetchDuel();
    } catch (err: any) {
      toast.error(err.message || "Failed to check in");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!duelId || !currentRound || !selectedOptionId) return;
    setIsSubmittingAnswer(true);
    try {
      const responseTimeMs = Date.now() - questionStartTime;
      await submitAnswerMutation.mutateAsync({
        params: { 
          path: {
            id: duelId,
            roundNumber: currentRound.roundNumber
          }
        },
        body: {
          lotItemId: selectedOptionId,
          responseTimeMs
        }
      });
      toast.success("Answer submitted!");
      refetchDuel();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit answer");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && !hasSubmittedCurrentRound && selectedOptionId) {
      handleSubmitAnswer();
    }
  }, [timeLeft, hasSubmittedCurrentRound, selectedOptionId]);

  // Timer percentage and styling
  const { percentage, barColor } = useMemo(() => {
    if (!question || !question.timeLimitSeconds) return { percentage: 100, barColor: "bg-emerald-500" };
    const pct = (timeLeft / question.timeLimitSeconds) * 100;
    let color = "bg-gradient-to-r from-emerald-500 to-green-500";
    if (timeLeft <= 5) color = "bg-gradient-to-r from-red-500 to-rose-500 animate-pulse";
    else if (timeLeft <= 10) color = "bg-gradient-to-r from-amber-500 to-orange-500";
    return { percentage: pct, barColor: color };
  }, [timeLeft, question]);

  // Score calculations
  const { myScore, opponentScore } = useMemo(() => {
    if (!duel || !duel.rounds) return { myScore: 0, opponentScore: 0 };
    let mine = 0;
    let opp = 0;
    duel.rounds.forEach(r => {
      if (r.winnerUserId?.toString() === userId?.toString()) mine++;
      else if (r.winnerUserId && r.winnerUserId?.toString() !== userId?.toString()) opp++;
    });
    return { myScore: mine, opponentScore: opp };
  }, [duel, userId]);

  if (loadingDuel) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (duelError || !duel) {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Error</h4>
            <p className="text-xs mt-0.5">
              {duelError ? (duelError as any).message : "Failed to load duel."}
            </p>
          </div>
        </div>
        <Button className="mt-4 w-full" asChild>
          <Link to={"/student/duels" as any}>Back to Duels Dashboard</Link>
        </Button>
      </div>
    );
  }

  const myPlayerInfo = duel.players.find(p => p.userId?.toString() === userId?.toString());
  const checkedIn = !!myPlayerInfo?.joinedAt;

  // Render state: Lobby / Pending Check-In
  if (duel.status === "PENDING" || duel.status === "READY") {
    return (
      <div className="container mx-auto py-8 max-w-2xl px-4 space-y-6">
        <Button variant="ghost" asChild className="gap-2 mb-4">
          <Link to={"/student/duels" as any}>
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <Card className="border-t-4 border-t-amber-500 shadow-lg">
          <CardHeader className="text-center pb-2">
            <SwordsIcon className="h-12 w-12 text-amber-500 mx-auto animate-bounce" />
            <CardTitle className="text-2xl mt-4">Spurti Battle Lobby</CardTitle>
            <CardDescription>{courseName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h3 className="font-semibold text-sm">Match Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>Match Mode: <span className="font-medium text-foreground">{duel.matchType}</span></div>
                <div>Rounds Limit: <span className="font-medium text-foreground">{duel.roundCount}</span></div>
                {duel.scheduledFor && (
                  <div className="col-span-2 text-amber-500 font-medium">
                    Scheduled For: {new Date(duel.scheduledFor).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Players Status</h3>
              {duel.players.map((p) => (
                <div key={p.userId} className="flex justify-between items-center bg-background p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {p.userId?.toString() === userId?.toString() ? "You" : `Opponent`}
                    </span>
                  </div>
                  <Badge variant={p.joinedAt ? "success" : "secondary"}>
                    {p.joinedAt ? "Checked In" : "Waiting..."}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Check-In Action Button */}
            {!checkedIn && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 p-4 rounded-lg flex items-start gap-3">
                <Clock className="h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Action Required</h4>
                  <p className="text-xs mt-0.5">
                    You must check in to participate in the battle. Unresolved players result in walkovers.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {!checkedIn ? (
              <Button onClick={handleCheckIn} disabled={isCheckingIn} className="w-full bg-amber-500 hover:bg-amber-600 gap-2">
                {isCheckingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Check In Now
              </Button>
            ) : (
              <Button disabled className="w-full gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for classmate to join...
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render state: Active Battle (IN_PROGRESS)
  if (duel.status === "IN_PROGRESS" && currentRound) {
    const isSuddenDeath = currentRound.isSuddenDeath;

    return (
      <div className="container mx-auto py-8 max-w-3xl px-4 space-y-6">
        {/* Battle Header / Live Scores */}
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-lg">
          <CardContent className="py-6 flex justify-between items-center">
            <div className="text-center flex-1">
              <span className="text-xs text-slate-400 block uppercase font-semibold">You</span>
              <span className="text-3xl font-extrabold text-primary">{myScore}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Swords className="h-6 w-6 text-red-500 animate-pulse" />
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-none text-[10px] tracking-wider">
                {isSuddenDeath ? `SUDDEN DEATH RD ${currentRound.roundNumber}` : `ROUND ${currentRound.roundNumber} / ${duel.roundCount}`}
              </Badge>
            </div>
            <div className="text-center flex-1">
              <span className="text-xs text-slate-400 block uppercase font-semibold">Opponent</span>
              <span className="text-3xl font-extrabold text-red-400">{opponentScore}</span>
            </div>
          </CardContent>
        </Card>

        {/* Question Panel */}
        {hasSubmittedCurrentRound ? (
          /* Waiting State: Submitted but Opponent hasn't */
          <Card className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <CardTitle>Answer Locked In</CardTitle>
            <CardDescription className="max-w-[400px]">
              Waiting for your opponent to submit their answer. Once both submit, the round outcome will resolve.
            </CardDescription>
          </Card>
        ) : loadingQuestion ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : question ? (
          /* Active Question display */
          <Card className="shadow-md overflow-hidden relative">
            {question.timeLimitSeconds && (
              <div className="w-full h-1.5 bg-muted/60 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${barColor}`} 
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
            <CardHeader>
              <div className="flex justify-between items-center mb-2">
                <Badge variant="outline">SELECT ONE IN LOT</Badge>
                {question.timeLimitSeconds && (
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1.5 px-3 py-1 font-bold text-xs border rounded-full transition-all duration-300 ${
                      timeLeft <= 5 
                        ? "bg-red-500/10 text-red-600 border-red-500/30 animate-pulse" 
                        : timeLeft <= 10 
                          ? "bg-orange-500/10 text-orange-600 border-orange-500/30" 
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    }`}
                  >
                    <Clock className={`h-3.5 w-3.5 ${timeLeft <= 5 ? "animate-spin" : ""}`} />
                    <span>{timeLeft}s remaining</span>
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl leading-relaxed text-foreground">
                {question.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeLeft === 0 && !hasSubmittedCurrentRound && (
                <div className="flex items-center gap-2 text-red-600 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm font-semibold justify-center">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>Time's up! You missed this round.</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {options.map((opt: any) => {
                  const isSelected = selectedOptionId === opt._id;
                  return (
                    <Button
                      key={opt._id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setSelectedOptionId(opt._id)}
                      disabled={isSubmittingAnswer || timeLeft === 0}
                      className="justify-start text-left py-6 px-4 h-auto text-sm whitespace-normal"
                    >
                      <span className="h-5 w-5 rounded-full border flex items-center justify-center mr-3 text-xs font-semibold shrink-0">
                        {isSelected ? "✓" : ""}
                      </span>
                      {opt.text}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 py-4 flex justify-between">
              <p className="text-xs text-muted-foreground">
                Tip: If both answer correctly, the faster response wins the round!
              </p>
              <Button 
                onClick={handleSubmitAnswer} 
                disabled={isSubmittingAnswer || !selectedOptionId || timeLeft === 0}
                className="px-6"
              >
                {isSubmittingAnswer ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Answer
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="bg-muted border p-4 rounded-lg flex items-start gap-3">
            <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h4 className="font-semibold text-sm text-foreground">Loading Question</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Retrieving question details from server...
              </p>
            </div>
          </div>
        )}

        {/* Sidebar: Past Rounds History */}
        {duel.rounds.length > 1 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Rounds History</CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duel.rounds
                    .filter(r => r.winnerUserId !== undefined)
                    .map((r) => {
                      const roundResult = r.winnerUserId?.toString() === userId?.toString() ? "YOU WON" : (r.winnerUserId === null ? "DRAW" : "OPPONENT WON");
                      return (
                        <TableRow key={r.roundNumber}>
                          <TableCell className="py-2">#{r.roundNumber}</TableCell>
                          <TableCell className="py-2">
                            {r.isSuddenDeath ? <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-none text-[10px]">Sudden Death</Badge> : "Normal"}
                          </TableCell>
                          <TableCell className="py-2 font-medium">
                            <span 
                              className={
                                roundResult === "YOU WON" ? "text-green-500" :
                                roundResult === "OPPONENT WON" ? "text-red-500" : "text-muted-foreground"
                              }
                            >
                              {roundResult}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render state: Completed or Cancelled / Expired
  const isWinner = duel.winnerUserId === userId;
  const isDraw = duel.resolutionReason === "DRAW" || !duel.winnerUserId;
  const outcomeText = isDraw ? "DRAW MATCH" : (isWinner ? "YOU WON!" : "YOU LOST");

  return (
    <div className="container mx-auto py-8 max-w-xl px-4 space-y-6">
      <Card className="shadow-xl overflow-hidden border-none text-center">
        {/* Banner header based on outcome */}
        <div 
          className={
            isDraw ? "bg-slate-500 text-white p-8" :
            isWinner ? "bg-green-500 text-white p-8" : "bg-red-500 text-white p-8"
          }
        >
          {isWinner ? (
            <Trophy className="h-16 w-16 mx-auto animate-bounce" />
          ) : isDraw ? (
            <HelpCircle className="h-16 w-16 mx-auto" />
          ) : (
            <XCircle className="h-16 w-16 mx-auto" />
          )}

          <h1 className="text-3xl font-extrabold tracking-tight mt-4">{outcomeText}</h1>
          <p className="opacity-90 text-sm mt-1">{courseName}</p>
        </div>

        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <div>
              <span className="text-xs text-muted-foreground block uppercase">Your Score</span>
              <span className="text-2xl font-bold">{myScore}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block uppercase">Opponent Score</span>
              <span className="text-2xl font-bold">{opponentScore}</span>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <h3 className="font-semibold text-sm">Battle Resolution Details</h3>
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2 text-muted-foreground">
              <div>Resolution Type: <span className="font-medium text-foreground uppercase">{duel.resolutionReason || "NORMAL"}</span></div>
              <div>Points Awarded: <span className="font-medium text-foreground text-green-500">{duel.pointsAwarded ?? 0} HP</span></div>
              
              {/* Specialized description message per resolutionReason */}
              <div className="pt-2 border-t text-xs text-foreground/80">
                {duel.resolutionReason === "WALKOVER" && (
                  "Opponent failed to check in on time. Walkover win awarded!"
                )}
                {duel.resolutionReason === "MUTUAL_NO_SHOW" && (
                  "Neither player checked in on time. Match cancelled as mutual no-show."
                )}
                {duel.resolutionReason === "DRAW" && (
                  "Match ended in a draw after maximum sudden-death rounds."
                )}
                {duel.resolutionReason === "NORMAL" && (
                  "Match played to completion normally."
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/30 py-4 flex gap-2">
          <Button asChild className="w-full">
            <Link to={"/student/duels" as any}>Back to Duels Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
