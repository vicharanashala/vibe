import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertCircle, Loader2, Inbox, Clock, History, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  useMyPeerReviewAssignments,
  useMyReviewsGiven,
} from "@/hooks/hooks";
import { ReviewForm } from "./ReviewForm";

/**
 * Reviewer dashboard.
 *
 * Phase 4.2.5. Lists the current user's PENDING / OVERDUE peer review
 * assignments and completed reviews (history) with stats.
 */
export function ReviewerDashboard() {
  const assignmentsHook = useMyPeerReviewAssignments();
  const completedReviewsHook = useMyReviewsGiven();
  
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  if (assignmentsHook.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (assignmentsHook.error) {
    return (
      <div className="p-6 text-red-600 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Could not load your peer review queue: {assignmentsHook.error}
      </div>
    );
  }

  const assignments: any[] = (assignmentsHook.data ?? []).map(
    (a: any) => ({
      ...a,
      studentId: undefined,
      studentName: undefined,
      studentEmail: undefined,
    }),
  );

  const completedReviews = completedReviewsHook.data ?? [];

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-baseline">
        <h2 className="text-xl font-semibold">Your Peer Reviews</h2>
        <p className="text-xs text-muted-foreground">
          Double-blind: Submitters' identities are always hidden.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "pending"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("pending")}
        >
          <Inbox className="h-4 w-4" />
          Pending Reviews ({assignments.length})
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "completed"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("completed")}
        >
          <History className="h-4 w-4" />
          Review History ({completedReviews.length})
        </button>
      </div>

      {activeTab === "pending" && (
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No peer reviews assigned</p>
              <p className="text-sm mt-1">
                You have no pending peer reviews right now.
              </p>
            </div>
          ) : (
            assignments.map((a) => {
              const dueAt = a.dueAt ? new Date(a.dueAt) : null;
              const overdue = dueAt ? new Date() > dueAt : false;
              const isOpen = openAssignmentId === a._id;
              return (
                <Card key={a._id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">
                        Assessment Details
                      </CardTitle>
                      <div className="flex gap-2">
                        {a.status === "OVERDUE" || overdue ? (
                          <Badge variant="destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Due{" "}
                      {dueAt
                        ? dueAt.toLocaleString()
                        : "(no deadline set)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You will see only the submission links and notes — the
                      submitter's identity is hidden by design.
                    </p>
                    {!isOpen ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setOpenAssignmentId(a._id)}
                      >
                        <Eye className="h-4 w-4 mr-2" /> Review now
                      </Button>
                    ) : (
                      <ReviewForm
                        assignmentId={a._id}
                        onClose={() => {
                          setOpenAssignmentId(null);
                          assignmentsHook.refetch();
                          completedReviewsHook.refetch();
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === "completed" && (
        <div className="space-y-3">
          {completedReviewsHook.isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : completedReviewsHook.error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Failed to load review history: {completedReviewsHook.error}
            </div>
          ) : completedReviews.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No reviews completed yet</p>
              <p className="text-sm mt-1">
                Completed peer reviews will appear here.
              </p>
            </div>
          ) : (
            completedReviews.map((rev: any) => {
              const isExpanded = expandedReviewId === rev.assignmentId;
              return (
                <Card key={rev.assignmentId}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {rev.assessmentTitle}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          Submitted {new Date(rev.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rev.teacherOverridden && (
                          <Badge variant="destructive" className="py-0">
                            Overridden
                          </Badge>
                        )}
                        {rev.isLate && (
                          <Badge variant="secondary" className="py-0">
                            Late
                          </Badge>
                        )}
                        <span className="font-mono font-bold text-sm bg-muted px-2.5 py-1 rounded">
                          {rev.totalScore} pts
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {rev.overallComment && (
                      <div className="text-sm bg-muted/20 border rounded p-3 italic">
                        <span className="font-semibold not-italic text-xs text-muted-foreground block mb-1">Your Comment</span>
                        "{rev.overallComment}"
                      </div>
                    )}
                    
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setExpandedReviewId(isExpanded ? null : rev.assignmentId)}
                      >
                        {isExpanded ? (
                          <>Hide Scores <ChevronUp className="h-3 w-3 ml-1" /></>
                        ) : (
                          <>Show Scores <ChevronDown className="h-3 w-3 ml-1" /></>
                        )}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 border-t pt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Criterion Scores Given</p>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {(rev.scores || []).map((scoreObj: any, idx: number) => {
                            const max = rev.rubric?.find((r: any) => r.criterionId === scoreObj.criterionId)?.maxPoints;
                            return (
                              <div key={idx} className="border rounded-md p-2.5 bg-background shadow-sm">
                                <div className="flex justify-between items-baseline gap-2">
                                  <span className="font-semibold text-xs truncate" title={scoreObj.criterionId}>
                                    {scoreObj.criterionId}
                                  </span>
                                  <span className="font-mono text-xs font-bold shrink-0">
                                    {scoreObj.score} {max !== undefined ? `/ ${max}` : "pts"}
                                  </span>
                                </div>
                                {scoreObj.comment && (
                                  <p className="text-xs text-muted-foreground mt-1.5 italic border-t pt-1">
                                    "{scoreObj.comment}"
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default ReviewerDashboard;
