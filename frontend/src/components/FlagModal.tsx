import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle  } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem, } from './ui/select';
import { useState } from 'react';

type FlagModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string,status?:string) => void;
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
  isSubmitting = false,teacher = false
}: FlagModalProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState("REPORTED");

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
    if(teacher)
      onSubmit(reason,status);
    else
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
            <label className="text-sm font-medium">Status</label>
              {teacher&&  <Select value={status} onValueChange={setStatus}>
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
           }
        </div>
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