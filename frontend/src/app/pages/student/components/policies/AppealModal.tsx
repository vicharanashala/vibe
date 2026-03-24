import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: string;
  onSubmit: (data: { reason: string; evidenceUrl?: string }) => Promise<void>;
};

export function AppealModal({ isOpen, onClose, onSubmit, enrollmentId }: Props) {
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    try {
      setLoading(true);
      await onSubmit({ reason, evidenceUrl });
      onClose();
      setReason("");
      setEvidenceUrl("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
  if (!open) onClose();
}}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Submit Appeal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Explain why you should be reinstated..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <Input
            placeholder="Optional evidence link (Google Drive, etc.)"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
          />

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Submit Appeal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}