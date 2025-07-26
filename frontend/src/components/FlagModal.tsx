import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle,  } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

type FlagModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
};

export const FlagModal = ({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
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
          <DialogTitle>Flag Content</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Textarea
              value={reason}
              onChange={handleReasonChange}
              onKeyDown={(e)=>e.stopPropagation()}
              placeholder="Please explain why you're flagging this content (minimum 8 characters)..."
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
              {isSubmitting ? "Submitting..." : "Submit Flag"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};