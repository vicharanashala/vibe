import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertCircle, Loader2, Inbox, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useMyPeerReviewAssignments,
} from "@/hooks/hooks";
import { ReviewForm } from "./ReviewForm";

/**
 * Reviewer dashboard.
 *
 * Phase 4.2.5. Lists the current user's PENDING / OVERDUE peer review
 * assignments and opens ReviewForm for each one.
 *
 * Double-blind guarantee: the server response payload is filtered at
 * the controller layer (allow-list); this component trusts that. We
 * additionally NEVER display studentId / studentName / studentEmail
 * here, even if they were in the response.
 */

export function ReviewerDashboard() {
  const assignmentsHook = useMyPeerReviewAssignments();
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);

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
      // Defense in depth: any submitter-side field that might sneak
      // through is stripped at this boundary. None of these fields are
      // ever set by the server's allow-list, but if a future
      // controller change regresses, this UI still protects.
      studentId: undefined,
      studentName: undefined,
      studentEmail: undefined,
    }),
  );

  if (assignments.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No peer reviews assigned</p>
        <p className="text-sm mt-1">
          You have no pending peer reviews right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-baseline">
        <h2 className="text-xl font-semibold">Your peer reviews</h2>
        <p className="text-xs text-muted-foreground">
          {assignments.length} pending review
          {assignments.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-3">
        {assignments.map((a) => {
          const dueAt = a.dueAt ? new Date(a.dueAt) : null;
          const overdue = dueAt ? new Date() > dueAt : false;
          const isOpen = openAssignmentId === a._id;
          return (
            <Card key={a._id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    Assessment {a.assessmentId}
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
                    }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ReviewerDashboard;
