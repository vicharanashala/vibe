// @ts-nocheck

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Users, Loader2 } from "lucide-react";
import { useChooseTimeSlot, useGetTimeSlots } from "@/hooks/hooks";
import { cn } from "@/utils/utils";

interface TimeSlot {
  from: string;
  to: string;
  studentIds: string[];
  maxStudents?: number;
}

interface StudentTimeslotModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
  currentUserId: string;
  hasAssignedTimeslot: boolean;
}

// Helper component for time display
const TimeDisplay = ({ time }: { time: string }) => {
  const [hour, minute] = time.split(':');
  const h = parseInt(hour);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minute} ${suffix}`;
};

export default function StudentTimeslotModal({ 
  isOpen, 
  onClose, 
  courseId, 
  courseVersionId, 
  currentUserId,
  hasAssignedTimeslot 
}: StudentTimeslotModalProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: timeSlotsData, isLoading, refetch } = useGetTimeSlots(courseId, courseVersionId, isOpen);
  const chooseTimeSlotMutation = useChooseTimeSlot();

  // Check if a timeslot is at capacity
  const isTimeslotFull = (slot: TimeSlot) => {
    if (!slot.maxStudents) return false;
    return slot.studentIds.length >= slot.maxStudents;
  };

  // Handle timeslot selection
  const handleChooseTimeSlot = async (slot: TimeSlot) => {
    if (isTimeslotFull(slot)) {
      toast.error('This time slot is full. Please choose another time slot.');
      return;
    }

    setSelectedTimeSlot(slot);
  };

  // Handle save selection
  const handleSaveSelection = async () => {
    if (!selectedTimeSlot) {
      toast.error('Please select a time slot first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await chooseTimeSlotMutation.mutateAsync({
        body: {
          courseId,
          courseVersionId,
          timeSlot: { from: selectedTimeSlot.from, to: selectedTimeSlot.to }
        }
      });
      
      toast.success('Time slot chosen successfully');
      refetch();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to choose time slot');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedTimeSlot(null);
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTimeSlot(null);
    }
  }, [isOpen]);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Time Slots</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading time slots...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!timeSlotsData?.isActive) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Time Slots</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No time slots are configured for this course. You can watch the course anytime.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-semibold">Choose Your Time Slot</DialogTitle>
        </DialogHeader>

        {hasAssignedTimeslot ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 rounded-lg p-4">
                <p className="font-medium mb-2">You already have a time slot assigned</p>
                <p className="text-sm">Contact your instructor if you need to change your time slot.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {timeSlotsData.slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No time slots are available for this course.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeSlotsData.slots.map((slot, index) => {
                  const isFull = isTimeslotFull(slot);
                  const isSelected = selectedTimeSlot?.from === slot.from && selectedTimeSlot?.to === slot.to;
                  
                  return (
                    <Card 
                      key={index} 
                      className={cn(
                        "border transition-all cursor-pointer",
                        isFull 
                          ? "opacity-60 cursor-not-allowed border-red-200 bg-red-50/30" 
                          : isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "hover:border-primary hover:shadow-sm"
                      )}
                      onClick={() => !isFull && handleChooseTimeSlot(slot)}
                    >
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-primary" />
                            <div>
                              <div className="font-medium text-l">
                                <TimeDisplay time={slot.from} /> - <TimeDisplay time={slot.to} />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {slot.studentIds.length} student{slot.studentIds.length !== 1 ? 's' : ''} enrolled
                              </div>
                            </div>
                          </div>
                          {slot.maxStudents && (
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              isFull 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : slot.studentIds.length >= slot.maxStudents * 0.8
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                : 'bg-green-100 text-green-700 border border-green-200'
                            )}>
                              <Users className="h-3 w-3" />
                              <span>{slot.studentIds.length}/{slot.maxStudents}</span>
                              {isFull ? ' Full' : 
                               slot.studentIds.length >= slot.maxStudents * 0.8 ? ' Almost Full' : ''}
                            </div>
                          )}
                          
                          {/* Radio button */}
                          <div className="flex items-center">
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                              isFull
                                ? "border-gray-300 bg-gray-100 cursor-not-allowed"
                                : isSelected
                                ? "border-primary bg-primary"
                                : "border-gray-300 bg-white hover:border-primary"
                            )}>
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isFull && (
                          <div className="mt-2 text-xs text-red-600 font-medium">
                            This time slot is full. Please choose another time slot.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handleSaveSelection}
                disabled={!selectedTimeSlot || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Selection'
                )}
              </Button>
              <Button 
                onClick={handleCancel}
                variant="outline"
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            <p>• You can only choose one time slot per course.</p>
            <p>• Once selected, contact your instructor to make changes.</p>
            <p>• Time slots are shown in your local timezone.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
