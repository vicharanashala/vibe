import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, ExternalLink, CheckCircle, XCircle, Clock } from "lucide-react";
import { useGetAppeals, useApproveAppeal, useRejectAppeal } from "@/hooks/system-notification-hooks";
import { queryClient } from "@/lib/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Appeal = {
  _id: string;
  userId: string;
  reason: string;
  evidenceUrl?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  adminResponse?: string;
};

type Props = {
  courseId: string;
  courseVersionId: string;
  cohortId: string;
};

const statusConfig = {
  PENDING: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200",
  },
  APPROVED: {
    label: "Approved",
    icon: <CheckCircle className="h-3 w-3" />,
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200",
  },
  REJECTED: {
    label: "Rejected",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200",
  },
};

function AppealCard({
  appeal,
  onAction,
}: {
  appeal: Appeal;
  onAction: () => void;
}) {
  const config = statusConfig[appeal.status];
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const approveMutation = useApproveAppeal();
  const rejectMutation = useRejectAppeal();

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await approveMutation.mutateAsync({ params: { path: { id: appeal._id } } });
      toast.success("Appeal approved — student reinstated.");
      queryClient.invalidateQueries({ queryKey: ["get", "/appeals"] });
      onAction();
    } catch {
      toast.error("Failed to approve appeal.");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({
        params: { path: { id: appeal._id } },
        body: { reason: rejectReason },
      });
      toast.success("Appeal rejected.");
      queryClient.invalidateQueries({ queryKey: ["get", "/appeals"] });
      setShowRejectModal(false);
      onAction();
    } catch {
      toast.error("Failed to reject appeal.");
    }
  };

  return (
    <>
      <Card className="p-4 space-y-3 border border-border/50 bg-card/60 backdrop-blur-sm hover:border-border transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-mono truncate">
                Student: {appeal.userId}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(appeal.createdAt).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </p>
            </div>
          </div>

          <Badge className={`flex items-center gap-1 text-xs font-medium border shrink-0 ${config.className}`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>

        {/* Reason */}
        <div className="bg-muted/40 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
          <p className="text-sm text-foreground leading-relaxed">{appeal.reason}</p>
        </div>

        {/* Evidence */}
        {appeal.evidenceUrl && (
          <a
            href={appeal.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View Evidence
          </a>
        )}

        {/* Admin response on rejected */}
        {appeal.status === "REJECTED" && appeal.adminResponse && (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-md px-3 py-2">
            <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Rejection Reason</p>
            <p className="text-xs text-red-700 dark:text-red-300">{appeal.adminResponse}</p>
          </div>
        )}

        {/* Actions — only for PENDING */}
        {appeal.status === "PENDING" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              Approve & Reinstate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => { e.stopPropagation(); setShowRejectModal(true); }}
              disabled={rejectMutation.isPending}
              className="h-8 text-xs"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </Card>

      {/* Reject reason modal */}
      <Dialog open={showRejectModal} onOpenChange={(o) => { if (!o) setShowRejectModal(false); }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reject Appeal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
              </Button>
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppealsTab({ courseId, courseVersionId, cohortId }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const { appeals, isLoading, refetch } = useGetAppeals(
    courseId,
    courseVersionId,
    cohortId,
    statusFilter,
    true,
  );

  const filters: { label: string; value: string }[] = [
    { label: "Pending", value: "PENDING" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? "default" : "outline"}
            onClick={() => setStatusFilter(f.value)}
            className="h-8 text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : appeals.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No {statusFilter.toLowerCase()} appeals for this cohort.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appeals.map((appeal: Appeal) => (
            <AppealCard key={appeal._id} appeal={appeal} onAction={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}