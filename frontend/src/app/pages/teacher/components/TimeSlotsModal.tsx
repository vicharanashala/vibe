// @ts-nocheck

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Clock, Users, Plus, Trash2, Save, Edit, Check, X, UserPlus, Calendar } from "lucide-react";
import {
  useGetTimeSlots,
  useAddTimeSlots,
  useRemoveTimeSlots,
  useToggleTimeSlots,
  useUpdateTimeSlot,
  useCourseVersionEnrollments,
  useRemoveStudentFromTimeSlot
} from "@/hooks/hooks";
import { ClockTimePicker } from "./ClockTimePicker";

interface TimeSlot {
  from: string;
  to: string;
  studentIds: string[];
  maxStudents?: number;
}

interface TimeSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseVersionId: string;
}

// Helper component for time display
const TimeDisplay = ({ time }: { time: string }) => {
  const [hour, minute] = time.split(':');
  const h = parseInt(hour);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minute} ${suffix}`;
};

// Floating selection indicator component
const SelectionIndicator = ({
  slot,
  selectedCount,
  onFinalize,
  onChange,
  onCancel,
  isPending
}: {
  slot: TimeSlot | null;
  selectedCount: number;
  onFinalize: () => void;
  onChange: () => void;
  onCancel: () => void;
  isPending: boolean;
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 min-w-[320px] max-w-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-card-foreground">
              {slot ? <TimeDisplay time={slot.from} /> : 'Time Slot'} - {slot ? <TimeDisplay time={slot.to} /> : ''}
            </div>
            <div className="text-xs text-muted-foreground">Student selection in progress</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-muted rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium text-card-foreground">{selectedCount} student{selectedCount !== 1 ? 's' : ''} selected</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onFinalize}
          disabled={isPending || selectedCount === 0}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Confirm Assignment
        </Button>
        <Button
          variant="outline"
          onClick={onChange}
          className="border-border text-foreground hover:bg-muted"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Change
        </Button>
      </div>
    </div>
  );
};

function TimeSlotsModal({ isOpen, onClose, courseId, courseVersionId }: TimeSlotsModalProps) {


  // Early return if courseId or courseVersionId are invalid
  if (!courseId || !courseVersionId || courseId.length !== 24 || courseVersionId.length !== 24) {
    if (isOpen) {
      onClose();
    }
    return null;
  }

  const [enableSlotAssignment, setEnableSlotAssignment] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [newTimeSlot, setNewTimeSlot] = useState<TimeSlot>({
    from: "",
    to: "",
    studentIds: []
  });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isAddingTimeSlot, setIsAddingTimeSlot] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null);
  const [originalSlot, setOriginalSlot] = useState<TimeSlot | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentSlotForStudents, setCurrentSlotForStudents] = useState<TimeSlot | null>(null);
  const [tempSelectedStudents, setTempSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Hooks
  const { data: timeSlotsData, refetch: refetchTimeSlots } = useGetTimeSlots(
    courseId && courseId.length === 24 && courseVersionId && courseVersionId.length === 24
      ? courseId
      : undefined,
    courseVersionId && courseVersionId.length === 24
      ? courseVersionId
      : undefined
  );

  const addTimeSlotsMutation = useAddTimeSlots();
  const removeTimeSlotsMutation = useRemoveTimeSlots();
  const toggleTimeSlotsMutation = useToggleTimeSlots();
  const updateTimeSlotMutation = useUpdateTimeSlot();
  const removeStudentFromTimeSlotMutation = useRemoveStudentFromTimeSlot();

  // Get enrolled students for selection
  const { data: enrollmentsData } = useCourseVersionEnrollments(
    courseId && courseId.length === 24 ? courseId : undefined,
    courseVersionId && courseVersionId.length === 24 ? courseVersionId : undefined,
    1,
    1000,
    "",
    "name",
    "asc",
    true,
    "STUDENT",
    "ACTIVE"
  );

  const enrolledStudents = enrollmentsData?.enrollments || [];

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && timeSlotsData) {
      setEnableSlotAssignment(timeSlotsData.isActive);
      setTimeSlots(timeSlotsData.slots || []);
    }
  }, [isOpen, timeSlotsData]);

  // Handle toggle time slots
  const handleToggleTimeSlots = async () => {
    if (!courseId || courseId.length !== 24) {
      toast.error('Invalid course ID');
      return;
    }

    if (!courseVersionId || courseVersionId.length !== 24) {
      toast.error('Invalid course version ID');
      return;
    }

    // If toggling off and there are students assigned, show confirmation
    if (enableSlotAssignment && timeSlots.length > 0) {
      const totalAssignedStudents = timeSlots.reduce((total, slot) => total + (slot.studentIds?.length || 0), 0);
      
      if (totalAssignedStudents > 0) {
        const message = `Are you sure you want to disable time slots? This will remove all time slot assignments for ${totalAssignedStudents} student(s) and delete all existing time slots.`;
        
        if (!window.confirm(message)) {
          return; // User cancelled
        }
      }
    }

    try {
      await toggleTimeSlotsMutation.mutateAsync({
        body: {
          courseId,
          courseVersionId,
          isActive: !enableSlotAssignment
        }
      });

      setEnableSlotAssignment(!enableSlotAssignment);
      toast.success(`Time slots ${!enableSlotAssignment ? 'enabled' : 'disabled'} successfully`);
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to toggle time slots');
    }
  };


  const getStudentName = (studentId: string) => {
    const student = enrolledStudents.find((enrollment: any) =>
      enrollment.user && enrollment.user._id === studentId
    );
    return student && student.user ? `${student.user.firstName} ${student.user.lastName}` : 'Unknown';
  };

  // Handle assign students click
  const handleAssignStudents = (slot: TimeSlot) => {
    setCurrentSlotForStudents(slot);
    setTempSelectedStudents(new Set(slot.studentIds));
    setIsMinimized(true);
    // Trigger selection mode in current page
    window.dispatchEvent(new CustomEvent('enableSelectionMode', {
      detail: { slot }
    }));
  };

  // Handle finalize student assignment
  const handleFinalizeAssignment = async () => {
    if (!currentSlotForStudents) return;

    try {
      // Update the slot with new student assignments
      const updatedSlot = {
        ...currentSlotForStudents,
        studentIds: Array.from(tempSelectedStudents)
      };

      // Remove old slot and add updated one
      await handleRemoveTimeSlot(currentSlotForStudents);

      if (updatedSlot.from && updatedSlot.to) {
        await addTimeSlotsMutation.mutateAsync({
          body: {
            courseId,
            courseVersionId,
            timeSlots: [updatedSlot]
          }
        });
      }
      setIsMinimized(false);
      setCurrentSlotForStudents(null);
      setTempSelectedStudents(new Set());
      setEditingSlotId(null);
      setEditSlot(null);
      setOriginalSlot(null);
      toast.success('Student assignments updated successfully');
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to update student assignments');
    }
  };

  // Handle cancel assignment
  const handleCancelAssignment = () => {
    setIsMinimized(false);
    setCurrentSlotForStudents(null);
    setTempSelectedStudents(new Set());
  };

  // Listen for student selection from other page
  useEffect(() => {
    const handleStudentSelection = (event: CustomEvent) => {
      const { selectedStudentIds } = event.detail;
      if (currentSlotForStudents) {
        setTempSelectedStudents(new Set(selectedStudentIds));
      }
    };

    window.addEventListener('studentSelectionComplete', handleStudentSelection as EventListener);
    return () => {
      window.removeEventListener('studentSelectionComplete', handleStudentSelection as EventListener);
    };
  }, [currentSlotForStudents]);

  // Handle add time slot
  const handleAddTimeSlot = async () => {
    if (!courseId || courseId.length !== 24) {
      toast.error('Invalid course ID');
      return;
    }

    if (!courseVersionId || courseVersionId.length !== 24) {
      toast.error('Invalid course version ID');
      return;
    }

    if (!newTimeSlot.from || !newTimeSlot.to) {
      toast.error('Please specify both start and end times');
      return;
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTimeSlot.from) || !timeRegex.test(newTimeSlot.to)) {
      toast.error('Please use HH:MM format (24-hour)');
      return;
    }

    const [fromHour, fromMin] = newTimeSlot.from.split(':').map(Number);
    const [toHour, toMin] = newTimeSlot.to.split(':').map(Number);
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;

    if (fromMinutes >= toMinutes) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      await addTimeSlotsMutation.mutateAsync({
        body: {
          courseId,
          courseVersionId,
          timeSlots: [{
            ...newTimeSlot,
            studentIds: Array.from(selectedStudents),
            maxStudents: newTimeSlot.maxStudents || undefined
          }]
        }
      });

      setNewTimeSlot({ from: "", to: "", studentIds: [], maxStudents: undefined });
      setSelectedStudents(new Set());
      setIsAddingTimeSlot(false);
      const studentCount = selectedStudents.size;
      toast.success(`Time slot added successfully${studentCount > 0 ? ` with ${studentCount} student(s) assigned` : ''}`);
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to add time slot');
    }
  };

  // Handle remove time slot with confirmation
  const handleRemoveTimeSlotWithConfirmation = (timeSlotToRemove: TimeSlot) => {
    const studentCount = timeSlotToRemove.studentIds?.length || 0;
    const message = studentCount > 0
      ? `Are you sure you want to remove this time slot? This will also unenroll ${studentCount} student(s) from the course.`
      : 'Are you sure you want to remove this time slot?';

    if (window.confirm(message)) {
      handleRemoveTimeSlot(timeSlotToRemove);
    }
  };
  const handleRemoveTimeSlot = async (timeSlotToRemove: TimeSlot) => {
    if (!courseId || courseId.length !== 24) {
      toast.error('Invalid course ID');
      return;
    }

    if (!courseVersionId || courseVersionId.length !== 24) {
      toast.error('Invalid course version ID');
      return;
    }

    try {
      // Remove time slot
      await removeTimeSlotsMutation.mutateAsync({
        body: {
          courseId,
          courseVersionId,
          timeSlotsToRemove: [{
            from: timeSlotToRemove.from,
            to: timeSlotToRemove.to
          }]
        }
      });

      setTimeSlots(timeSlots.filter(
        slot => !(slot.from === timeSlotToRemove.from && slot.to === timeSlotToRemove.to)
      ));

      const studentCount = timeSlotToRemove.studentIds?.length || 0;
      toast.success(`Time slot removed successfully${studentCount > 0 ? ` (${studentCount} students were affected)` : ''}`);
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to remove time slot');
    }
  };

  // Handle remove individual student from time slot
  const handleRemoveStudentFromTimeSlot = async (timeSlot: TimeSlot, studentId: string) => {
 
    if (!courseId || courseId.length !== 24) {
      toast.error('Invalid course ID. Please refresh the page and try again.');
      return;
    }

    if (!courseVersionId || courseVersionId.length !== 24) {
      toast.error('Invalid course version ID. Please refresh the page and try again.');
      return;
    }

    const student = enrolledStudents.find((enrollment: any) =>
      enrollment.user && enrollment.user._id === studentId
    );
    const studentName = student && student.user ? `${student.user?.firstName} ${student.user?.lastName}` : 'Unknown';


    if (!window.confirm(`Are you sure you want to remove ${studentName} from this time slot?`)) {
      return;
    }

    try {
      await removeStudentFromTimeSlotMutation.mutateAsync({
        body:{

          courseId,
        courseVersionId,
        studentId,
        timeSlot: {
          from: timeSlot.from,
          to: timeSlot.to
        }
      }
      });

      toast.success(`${studentName} removed from time slot successfully`);
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to remove student from time slot');
    }
  };

  // Handle edit slot
  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlotId(`${slot.from}-${slot.to}`);
    setEditSlot({ ...slot });
    setOriginalSlot({ ...slot }); // Store original values
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editSlot || !originalSlot) return;

    try {
      // Call update endpoint instead of remove+add
      await updateTimeSlotMutation.mutateAsync({
        body: {
          courseId,
          courseVersionId,
          oldTimeSlot: {
            from: originalSlot.from,
            to: originalSlot.to,
            maxStudents: originalSlot.maxStudents
          },
          newTimeSlot: {
            from: editSlot.from,
            to: editSlot.to,
            maxStudents: editSlot.maxStudents
          }
        }
      });

      setEditingSlotId(null);
      setEditSlot(null);
      setOriginalSlot(null);
      toast.success('Time slot updated successfully');
      refetchTimeSlots();
    } catch (error) {
      toast.error('Failed to update time slot');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingSlotId(null);
    setEditSlot(null);
    setOriginalSlot(null);
  };

  return (
    <>
      {/* Minimized Modal - Use SelectionIndicator */}
      {isMinimized && (
        <SelectionIndicator
          slot={currentSlotForStudents}
          selectedCount={tempSelectedStudents.size}
          onFinalize={handleFinalizeAssignment}
          onChange={() => {
            // Return to modal instead of triggering selection mode again
            setIsMinimized(false);
          }}
          onCancel={handleCancelAssignment}
          isPending={addTimeSlotsMutation.isPending}
        />
      )}

      {/* Main Modal */}
      {!isMinimized && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-2xl font-bold text-primary">
                Time Slot Management
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Assign time intervals to students for controlled access</p>
            </DialogHeader>

            <div className="space-y-6 p-6">
              {/* Enable Slot Assignment Toggle */}
              <Card className="bg-card border-border">
                <CardContent className="p-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted p-1 rounded">
                        <Calendar className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-card-foreground">Enable Time Slot Assignment</h3>
                        <p className="text-xs text-muted-foreground">Restrict course access to specific time intervals</p>
                      </div>
                    </div>
                    <Switch
                      checked={enableSlotAssignment}
                      onCheckedChange={handleToggleTimeSlots}
                      disabled={toggleTimeSlotsMutation.isPending}
                    />
                  </div>
                </CardContent>
              </Card>

              {enableSlotAssignment && (
                <>
                  {/* Active Slots Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Active Slots
                      </h3>
                      {!isAddingTimeSlot && (
                        <Button
                          onClick={() => setIsAddingTimeSlot(true)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Time Slot
                        </Button>
                      )}
                    </div>

                    {/* Create New Time Slot Form - Appears at top */}
                    {isAddingTimeSlot && (
                      <Card className="border shadow-sm">
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Create New Time Slot</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setIsAddingTimeSlot(false);
                                  setNewTimeSlot({ from: "", to: "", studentIds: [], maxStudents: undefined });
                                  setSelectedStudents(new Set());
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Start Time</Label>
                                <ClockTimePicker
                                  value={newTimeSlot.from}
                                  onChange={(value) => setNewTimeSlot({ ...newTimeSlot, from: value })}
                                  label="Select Start Time"
                                />
                              </div>
                              <div>
                                <Label>End Time</Label>
                                <ClockTimePicker
                                  value={newTimeSlot.to}
                                  onChange={(value) => setNewTimeSlot({ ...newTimeSlot, to: value })}
                                  label="Select End Time"
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Maximum Students (Optional)</Label>
                              <Input
                                type="number"
                                min="1"
                                placeholder="Leave empty for unlimited"
                                value={newTimeSlot.maxStudents || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const value = e.target.value;
                                  setNewTimeSlot({ 
                                    ...newTimeSlot, 
                                    maxStudents: value ? parseInt(value) : undefined 
                                  });
                                }}
                                className="mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Maximum number of students allowed in this timeslot
                              </p>
                            </div>

                            <div>
                              <Label>Assign Students (Optional)</Label>
                              <Button
                                variant="outline"
                                onClick={() => handleAssignStudents(newTimeSlot)}
                                className="mt-2 w-full"
                                disabled={!newTimeSlot.from || !newTimeSlot.to}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {selectedStudents.size > 0 ? `Assign Students (${selectedStudents.size} selected)` : 'Assign Students'}
                              </Button>
                              <p className="text-xs text-muted-foreground mt-1">
                                {selectedStudents.size > 0 ? 'Click to navigate to student selection page' : 'Optional: Create time slot without assigning students'}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={handleAddTimeSlot}
                                disabled={addTimeSlotsMutation.isPending}
                              >
                                {addTimeSlotsMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 mr-2" />
                                )}
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsAddingTimeSlot(false);
                                  setNewTimeSlot({ from: "", to: "", studentIds: [], maxStudents: undefined });
                                  setSelectedStudents(new Set());
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {timeSlots.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No active time slots configured
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {timeSlots.map((slot, index) => (
                          <Card key={index} className="border shadow-sm">
                            <CardContent className="">
                              {editingSlotId === `${slot.from}-${slot.to}` ? (
                                // Edit Mode
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-medium text-sm">Edit Slot</h4>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs">Start Time</Label>
                                      <ClockTimePicker
                                        value={editSlot?.from || ''}
                                        onChange={(value) => setEditSlot(prev => prev ? { ...prev, from: value } : null)}
                                        label="Select Start Time"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">End Time</Label>
                                      <ClockTimePicker
                                        value={editSlot?.to || ''}
                                        onChange={(value) => setEditSlot(prev => prev ? { ...prev, to: value } : null)}
                                        label="Select End Time"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Maximum Students</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Unlimited"
                                      value={editSlot?.maxStudents || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const value = e.target.value;
                                        setEditSlot(prev => prev ? { 
                                          ...prev, 
                                          maxStudents: value ? parseInt(value) : undefined 
                                        } : null);
                                      }}
                                      className="mt-1"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs">Assign Students</Label>
                                    <Button
                                      variant="outline"
                                      onClick={() => handleAssignStudents(editSlot!)}
                                      className="mt-1 w-full text-xs"
                                      disabled={updateTimeSlotMutation.isPending}
                                    >
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      Assign Students ({editSlot?.studentIds.length || 0} selected)
                                    </Button>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button onClick={handleSaveEdit} disabled={updateTimeSlotMutation.isPending} size="sm">
                                      {updateTimeSlotMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Save className="h-3 w-3 mr-1" />
                                      )}
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={handleCancelEdit}
                                      size="sm"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // Display Mode
                                <div
                                  className="flex items-center justify-between cursor-pointer rounded-lg p-1 -m-1 transition-colors"
                                  onClick={() => setSelectedTimeSlot(selectedTimeSlot === `${slot.from}-${slot.to}` ? null : `${slot.from}-${slot.to}`)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-primary" />
                                      <span className="font-medium text-xl">
                                        {slot ? <TimeDisplay time={slot.from} /> : 'Time Slot'} - {slot ? <TimeDisplay time={slot.to} /> : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>{slot.studentIds.length} Students</span>
                                      </div>
                                      {slot.maxStudents && (
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                          slot.studentIds.length >= slot.maxStudents 
                                            ? 'bg-red-100 text-red-700 border border-red-200' 
                                            : slot.studentIds.length >= slot.maxStudents * 0.8
                                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                            : 'bg-green-100 text-green-700 border border-green-200'
                                        }`}>
                                          <span>
                                            {slot.studentIds.length}/{slot.maxStudents} 
                                            {slot.studentIds.length >= slot.maxStudents ? ' (Full)' : 
                                             slot.studentIds.length >= slot.maxStudents * 0.8 ? ' (Almost Full)' : ''}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSlot(slot);
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTimeSlotWithConfirmation(slot);
                                      }}
                                      disabled={removeTimeSlotsMutation.isPending}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title={slot.studentIds?.length > 0 ? `Remove time slot and unenroll ${slot.studentIds.length} student(s)` : 'Remove time slot'}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Student List - Shows when time slot is selected */}
                              {selectedTimeSlot === `${slot.from}-${slot.to}` && slot.studentIds.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <div className="space-y-2">
                                    <h5 className="text-xs font-semibold text-card-foreground mb-2">Assigned Students:</h5>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {slot.studentIds.map((studentId) => {
                                        const student = enrolledStudents.find((enrollment: any) =>
                                          enrollment.user && enrollment.user._id === studentId
                                        );
                                        return student && student.user ? (
                                          <div key={studentId} className="flex items-center justify-between text-sm text-card-foreground bg-muted/30 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-primary text-sm font-semibold">
                                                  {student.user?.firstName?.[0] || student.user?.lastName?.[0] || 'U'}
                                                </span>
                                              </div>
                                              <span className="font-medium">
                                                {student.user?.firstName} {student.user?.lastName}
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveStudentFromTimeSlot(slot, studentId);
                                              }}
                                              disabled={removeStudentFromTimeSlotMutation.isPending}
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                                              title={`Remove ${student.user?.firstName} ${student.user?.lastName} from this time slot`}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default TimeSlotsModal;
