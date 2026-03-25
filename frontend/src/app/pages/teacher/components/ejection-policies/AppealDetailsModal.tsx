import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGetAppealById, useApproveAppeal, useRejectAppeal } from "@/hooks/system-notification-hooks";
import { useState } from "react";
import { toast } from "sonner";

export function AppealDetailsModal({ open, onClose, notification }) {
  const appealId = notification.extra?.appealId;

  const { data, isLoading } = useGetAppealById(appealId, open);

  const approveMutation = useApproveAppeal();
  const rejectMutation = useRejectAppeal();

  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) {
    return (
      <Dialog open={open}>
        <DialogContent>Loading...</DialogContent>
      </Dialog>
    );
  }

  const appeal = data;

  const handleApprove = async () => {
   try {
    await approveMutation.mutateAsync({
      params: { path: { id: appealId } },
    });

    toast.success("Appeal approved successfully ");

    onClose();
  } catch (err) {
    toast.error("Failed to approve appeal ");
  }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
    toast.error("Please enter a rejection reason ⚠️");
    return;
  }

  try {
    await rejectMutation.mutateAsync({
      params: { path: { id: appealId } },
      body: { reason: rejectReason },
    });

    toast.success("Appeal rejected successfully ");

    onClose();
  } catch (err) {
    toast.error("Failed to reject appeal");
  }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
    if (!isOpen) onClose();
  }}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Appeal Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">

          {/* Reason */}
          <div>
            <p className="font-medium">Reason</p>
            <p className="text-muted-foreground mt-1">
              {appeal?.reason}
            </p>
          </div>

          {/* Evidence */}
          {appeal?.evidenceUrl && (
            <div>
              <p className="font-medium">Evidence</p>
              <a
                href={appeal.evidenceUrl}
                target="_blank"
                className="text-blue-500 underline"
              >
                Open Evidence Link
              </a>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex flex-col gap-3 pt-4 border-t">

            {/* Approve */}
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isLoading}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {approveMutation.isLoading ? "Approving..." : "Approve & Reinstate"}
            </Button>

            {/* Reject */}
            <textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="border rounded p-2 text-sm"
            />

            <Button
              onClick={handleReject}
              disabled={
    rejectMutation.isLoading || !rejectReason.trim()
  }
              variant="destructive"
            >
              {rejectMutation.isLoading ? "Rejecting..." : "Reject Appeal"}
            </Button>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}