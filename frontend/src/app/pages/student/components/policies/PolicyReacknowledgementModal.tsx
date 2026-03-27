import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";
import { useState } from "react";
import { useActivePoliciesForCourse } from "@/hooks/ejection-policy-hooks";
import { StudentPolicyList } from "./StudentPolicyList";
import { useAcknowledgePolicyUpdate } from "@/hooks/system-notification-hooks";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
  cohortId: string;
  notificationId: string;
  onSuccess: () => void;
};

export function PolicyReacknowledgementModal({
  open, onClose, courseId, courseVersionId, cohortId, onSuccess,
}: Props) {
  const { policies, isLoading } = useActivePoliciesForCourse(courseId, courseVersionId, cohortId);
  const [checked, setChecked] = useState(false);
  const { mutateAsync, isPending } = useAcknowledgePolicyUpdate();

  const handleAcknowledge = async () => {
    try {
      await mutateAsync({
        params: { path: { courseId, courseVersionId, cohortId } },
      });
      toast.success("Policy acknowledged. You can continue your course.");
      onSuccess();
    } catch {
      toast.error("Failed to acknowledge policy.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Policy Updated — Re-acknowledgement Required
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          The ejection policy for this course has been updated. Please review and acknowledge the new policy to continue accessing the course.
        </p>

        <div className="max-h-[50vh] overflow-y-auto pr-2">
          {isLoading ? <div className="text-center py-6">Loading policies...</div> : <StudentPolicyList policies={policies} />}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
          <span className="text-sm">I have read and agree to the updated policies</span>
        </div>

        <div className="flex justify-end mt-4">
          <Button disabled={!checked || isPending} onClick={handleAcknowledge}>
            {isPending ? "Acknowledging..." : "Acknowledge & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}