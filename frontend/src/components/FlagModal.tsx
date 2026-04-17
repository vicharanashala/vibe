import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle  } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem, } from './ui/select';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

const FLAG_SKIP_ALERT_KEY = 'flag-skip-submit-alert';

type FlagModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string,status?:string) => void;
  isSubmitting?: boolean;
 teacher?:boolean
 selectedStatus?:string
};

const Teacher ={
title:"Update Status",
placeholder:"Please enter a reason for status update",
buttonText:"Submit",
submittingText:"Submitting..."
}

const Student ={
title:"Flag Content",
placeholder:"Please explain why you're flagging this content (minimum 8 characters)...",
buttonText:"Submit Flag",
submittingText:"Submitting..."
}

const statusTypes = [{ key: 'REPORTED', label: 'REPORTED' },
  { key: 'IN_REVIEW', label: 'IN REVIEW' },
  { key: 'RESOLVED', label: 'RESOLVED' },
  { key: 'DISCARDED', label: 'DISCARDED' },
  { key: 'CLOSED', label: 'CLOSED' },
];
export const FlagModal = ({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,teacher = false,selectedStatus=statusTypes[0].key
}: FlagModalProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState(selectedStatus);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value);
    if (error && e.target.value.trim().length >= 8) {
      setError('');
    }
  };

  const handleSubmit = () => {
    if (reason.trim().length < 8) {
      setError('Please provide at least 8 characters');
      return;
    }
    setError('');
    if (teacher) {
      onSubmit(reason, status);
    } else {
      onSubmit(reason);
    }
    setReason('');
  };

  // Called when user clicks "Raise Flag" on the pre-alert.
  // It only reveals the form; actual submit happens via handleSubmit.
  const handleRaiseFlag = () => {
    if (dontShowAgain) {
      localStorage.setItem(FLAG_SKIP_ALERT_KEY, 'true');
    }
    setShowConfirmAlert(false);
  };

  useEffect(()=>{
setStatus(selectedStatus)
  },[selectedStatus])

  useEffect(() => {
    if (open && !teacher && localStorage.getItem(FLAG_SKIP_ALERT_KEY) !== 'true') {
      setShowConfirmAlert(true);
      return;
    }
    setShowConfirmAlert(false);
  }, [open, teacher]);

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setShowConfirmAlert(false);
        setDontShowAgain(false);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[425px] max-w-sm max-[425px]:w-[90vw] overflow-hidden"
      onInteractOutside={(e) => e.preventDefault()} >

        {/* Confirmation overlay — covers the form when showConfirmAlert is true */}
        {showConfirmAlert && (
          <div className="absolute inset-0 z-10 flex flex-col rounded-lg overflow-hidden bg-gradient-to-b from-background to-muted/20 backdrop-blur-sm">
            {/* Header */}
            <div className="px-5 pt-4 pb-3 shrink-0 border-b bg-background/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">Before You Flag</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Please confirm this is related to content quality.</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 px-5 py-3 space-y-3 overflow-hidden">
              <div className="rounded-md border bg-card p-2.5">
                <p className="text-xs text-muted-foreground leading-normal">
                  Flags should only be raised when you have a genuine{' '}
                  <span className="font-medium text-foreground">issue or doubt regarding the content</span>{' '}
                  in the video or quiz.
                </p>
                <p className="text-xs text-muted-foreground leading-normal mt-1.5">
                  Please do not flag content for other reasons.
                </p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border bg-background/80 p-2.5">
                <Checkbox
                  id="dont-show-again"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <span className="text-xs text-muted-foreground leading-snug">Don't show this next time</span>
              </label>
            </div>
            {/* Buttons — always pinned at bottom */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-background/90 shrink-0">
              <Button
                variant="outline"
                className="min-w-20 h-8 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="min-w-24 h-8 text-xs"
                onClick={handleRaiseFlag}
              >
                Raise Flag
              </Button>
            </div>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>{teacher?Teacher.title:Student.title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
        {teacher && 
          <div className="grid gap-2">
            <label className="text-sm font-medium">Status</label>
               <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusTypes.map((status)=>(
                      <>
                      <SelectItem value={status.key}>{status.label}</SelectItem>
                      </>
                    )

                    )}
                 </SelectContent>
              </Select>
            </div>
           }
          <div className="grid gap-2">
            <Textarea
              value={reason}
              onChange={handleReasonChange}
              onKeyDown={(e)=>e.stopPropagation()}
              placeholder={teacher?Teacher.placeholder:Student.placeholder}
              className="min-h-[120px]"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                onOpenChange(false);
                setError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? teacher?Teacher.submittingText:Student.submittingText :teacher?Teacher.buttonText:Student.buttonText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};