import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useActivePoliciesForCourse } from "@/hooks/ejection-policy-hooks";
import { StudentPolicyList } from "./StudentPolicyList";
import { processInviteApi } from "@/hooks/hooks";

export function PolicyAcknowledgementModal({
  open,
  onClose,
  courseId,
  courseVersionId,
  inviteId
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
  inviteId: string;
}) {
  const { policies, isLoading } = useActivePoliciesForCourse(courseId, courseVersionId);

  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleAccept = async () => {
  if (!isChecked) return;

  setIsSubmitting(true);
  try {
    await processInviteApi(inviteId, "ACCEPT",true);

    onClose();
  } catch (err) {
    console.error(err);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleReject = async () => {
  setIsSubmitting(true);
  try {
    await processInviteApi(inviteId, "REJECTED");

    onClose();
  } catch (err) {
    console.error(err);
  } finally {
    setIsSubmitting(false);
  }
};
if (!inviteId) {
  console.error("❌ Missing inviteId", { inviteId });
  return null;
}

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
  if (!isOpen) onClose();
}}>
      <DialogContent className="max-w-4xl max-h-[90vh]" onInteractOutside={(e) => e.preventDefault()} >

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Accept Course Invite
          </DialogTitle>

            <DialogDescription>
            Please review and accept the policies before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-6">Loading policies...</div>
          ) : (
            <StudentPolicyList policies={policies} />
          )}
        </div>

        {/* Checkbox */}
        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            checked={isChecked}
            onCheckedChange={(val) => setIsChecked(!!val)}
          />
          <span className="text-sm">
            I have read and agree to these policies
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>

          <Button
            disabled={!isChecked || isSubmitting}
            onClick={handleAccept}
          >
            Accept & Continue
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}