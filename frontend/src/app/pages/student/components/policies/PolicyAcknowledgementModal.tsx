import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useActivePoliciesForCourse } from "@/hooks/ejection-policy-hooks";
import { StudentPolicyList } from "./StudentPolicyList";
import { processInviteApi } from "@/hooks/hooks";
import { useAcknowledgePolicyUpdate } from "@/hooks/system-notification-hooks";
import { toast } from "sonner";


interface PolicyAcknowledgementModalProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
  cohortId: string;
  /** Present for new-invite flow; omit (or pass "") for re-acknowledge flow. */
  inviteId?: string;
}

export function PolicyAcknowledgementModal({
  open,
  onClose,
  courseId,
  courseVersionId,
  cohortId,
  inviteId,
}: PolicyAcknowledgementModalProps) {
  // Treat empty string the same as absent — both mean re-acknowledge mode.
  const isInviteMode = Boolean(inviteId);

  const { policies, isLoading } = useActivePoliciesForCourse(
    courseId,
    courseVersionId,
    cohortId,
  );

  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acknowledgePolicy = useAcknowledgePolicyUpdate();

  // ── Accept ────────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!isChecked) return;
    setIsSubmitting(true);
    try {
      if (isInviteMode) {
        await processInviteApi(inviteId!, "ACCEPT", true);
      } else {
        await acknowledgePolicy.mutateAsync({ courseId, courseVersionId, cohortId });
        toast.success("Policy acknowledged. You can now access your course.");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reject (invite mode only) ─────────────────────────────────────────────

  const handleReject = async () => {
    if (!isInviteMode) return;
    setIsSubmitting(true);
    try {
      await processInviteApi(inviteId!, "REJECTED");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className=""
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary " />
            {isInviteMode
              ? "Accept Course Invite"
              : "Course Policy — Acknowledgement Required"}
          </DialogTitle>

          <DialogDescription className="mb-2 ml-1">
            {isInviteMode
              ? "Please review and accept the policies before continuing."
              : "A policy has been added or updated for your cohort. You must review and acknowledge it before you can continue accessing this course. Your progress has not been affected."}
          </DialogDescription>
        </DialogHeader>

        {/* Policy list */}
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">
              Loading policies…
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No policies configured for this course yet.
            </div>
          ) : (
            <StudentPolicyList policies={policies} />
          )}
        </div>

        {/* Checkbox */}
        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            id="policy-agree"
            checked={isChecked}
            onCheckedChange={(val) => setIsChecked(!!val)}
          />
          <label htmlFor="policy-agree" className="text-sm cursor-pointer">
            I have read and agree to{" "}
            {isInviteMode ? "these policies" : "the course policy"}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          {isInviteMode && (
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              Reject
            </Button>
          )}

          <Button
            disabled={!isChecked || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting
              ? "Processing…"
              : isInviteMode
              ? "Accept & Continue"
              : "Acknowledge & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}