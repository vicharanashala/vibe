import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';

interface StudentQuestionRejectDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function StudentQuestionRejectDialog({
  isOpen,
  isSubmitting,
  onCancel,
  onConfirm,
}: StudentQuestionRejectDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const trimmed = reason.trim();
  const disabled = isSubmitting || trimmed.length < 3 || trimmed.length > 500;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!isSubmitting && !open) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-[480px]"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Reject this submission</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="rejection-reason" className="text-sm font-medium">
            Rejection reason
          </Label>
          <Textarea
            id="rejection-reason"
            placeholder="Explain why this submission is being rejected (3–500 characters)"
            className="min-h-[100px] resize-none text-sm"
            maxLength={500}
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{trimmed.length}/500 characters</p>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(trimmed)}
            disabled={disabled}
          >
            {isSubmitting ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
