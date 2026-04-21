import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AttemptsOverDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AttemptsOverDialog: React.FC<AttemptsOverDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>All Attempts Used</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <div style={{ marginBottom: 12 }}>
            <strong>You have used all available attempts for this quiz.</strong>
          </div>
          <div style={{ marginBottom: 8 }}>
            You cannot attempt this quiz anymore. Please review your results or proceed to the next lesson.
          </div>
        </DialogDescription>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
