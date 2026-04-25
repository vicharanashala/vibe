import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AttemptInfoDialogProps {
  open: boolean;
  attemptNum: number;
  maxAttempts: number;
  onClose: () => void;
}

export const AttemptInfoDialog: React.FC<AttemptInfoDialogProps> = ({ open, attemptNum, maxAttempts, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quiz Attempt Info</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <div style={{ marginBottom: 12 }}>
            <strong>Great job attempting the quiz again!</strong>
          </div>
          <div style={{ marginBottom: 8 }}>
            This is your {attemptNum}
            {attemptNum === 1 ? 'st' : attemptNum === 2 ? 'nd' : attemptNum === 3 ? 'rd' : 'th'} attempt out of {maxAttempts} allowed.
          </div>
          <div>Your last attempt will be considered for the final score.</div>
        </DialogDescription>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
