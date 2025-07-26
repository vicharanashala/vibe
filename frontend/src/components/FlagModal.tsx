import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle,  } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

type FlagModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
 teacher?:boolean
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

export const FlagModal = ({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,teacher = false
}: FlagModalProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

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
    onSubmit(reason);
    setReason('');
  };
 
  return (
    <Dialog open={open} onOpenChange={onOpenChange} >
      <DialogContent className="sm:max-w-[425px] mx-2"
      onInteractOutside={(e) => e.preventDefault()} >
        <DialogHeader>
          <DialogTitle>{teacher?Teacher.title:Student.title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
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
              disabled={!reason.trim() || isSubmitting || !!error}
            >
              {isSubmitting ? teacher?Teacher.submittingText:Student.submittingText :teacher?Teacher.buttonText:Student.buttonText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};