import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCombinedPacingPlan, useSetCombinedPacingTarget, useClearCombinedPacingTarget } from '@/hooks/usePacingGroup';
import { bufferToHex } from '@/utils/helpers';
import { format } from 'date-fns';
import { Calendar, X, AlertCircle, CheckCircle2, HelpCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CombinedPacingPlannerProps {
  enrollments: any[];
}

export function CombinedPacingPlanner({ enrollments }: CombinedPacingPlannerProps) {
  const { data, isLoading, error } = useCombinedPacingPlan();
  const setCombinedTarget = useSetCombinedPacingTarget();
  const clearCombinedTarget = useClearCombinedPacingTarget();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]); // Array of concatenated courseId:versionId:cohortId
  const [targetDateInput, setTargetDateInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Filter active enrollments
  const activeEnrollments = enrollments.filter(e => (e.percentCompleted ?? 0) !== 100);

  // Sync state on load or change in data
  useEffect(() => {
    if (data?.hasSelection && data?.courses) {
      const selections = data.courses.map((c: any) => {
        // Find matching enrollment to get cohortId
        const match = enrollments.find(e =>
          bufferToHex(e.courseId) === c.courseId &&
          bufferToHex(e.courseVersionId) === c.courseVersionId
        );
        const cohortId = match?.cohortId ? bufferToHex(match.cohortId) : '';
        return `${c.courseId}:${c.courseVersionId}:${cohortId}`;
      });
      setSelectedCourses(selections);
      if (data.targetCompletionDate) {
        setTargetDateInput(format(new Date(data.targetCompletionDate), 'yyyy-MM-dd'));
      }
    } else {
      setSelectedCourses([]);
      setTargetDateInput('');
    }
  }, [data, isOpen, enrollments]);

  const handleToggleCourse = (key: string) => {
    setValidationError('');
    setSelectedCourses(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    if (selectedCourses.length === 0) {
      setValidationError('Please select at least one course.');
      return;
    }
    if (!targetDateInput) {
      setValidationError('Please choose a target date.');
      return;
    }

    const courseSelections = selectedCourses.map(key => {
      const [courseId, courseVersionId, cohortId] = key.split(':');
      return {
        courseId,
        courseVersionId,
        cohortId: cohortId || undefined,
      };
    });

    setCombinedTarget.mutate({
      body: {
        targetCompletionDate: new Date(targetDateInput).toISOString(),
        courseSelections,
      }
    } as any, {
      onSuccess: () => {
        toast.success('Combined pacing plan saved successfully!');
        setIsOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to save combined pacing plan.');
      }
    });
  };

  const handleClear = () => {
    clearCombinedTarget.mutate({} as any, {
      onSuccess: () => {
        toast.success('Combined pacing plan cleared.');
        setSelectedCourses([]);
        setTargetDateInput('');
        setIsOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to clear combined pacing plan.');
      }
    });
  };

  // Pace status color configuration
  const getPaceStatusDetails = (paceStatus: string, aheadOrBehindByDays: number | null) => {
    switch (paceStatus) {
      case 'ahead':
        return {
          badgeText: 'Ahead',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30',
          desc: `${aheadOrBehindByDays} days ahead of schedule. Great work!`,
          bgClass: 'bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20',
          dotClass: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        };
      case 'behind':
        return {
          badgeText: 'Behind',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30',
          desc: `${Math.abs(aheadOrBehindByDays || 0)} days behind schedule.`,
          bgClass: 'bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20',
          dotClass: 'bg-amber-500',
          icon: <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        };
      case 'on_track':
        return {
          badgeText: 'On Track',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30',
          desc: 'You are perfectly on track to complete all selected courses.',
          bgClass: 'bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20',
          dotClass: 'bg-blue-500',
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        };
      case 'no_data':
      default:
        return {
          badgeText: 'No Activity',
          badgeClass: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200/50 dark:border-neutral-700/50',
          desc: 'Not enough study history to determine pacing yet.',
          bgClass: 'bg-neutral-50/30 dark:bg-neutral-900/10 border border-neutral-100 dark:border-neutral-800/40',
          dotClass: 'bg-neutral-400',
          icon: <HelpCircle className="w-4 h-4 text-neutral-500" />
        };
    }
  };

  const status = data?.hasSelection ? getPaceStatusDetails(data.paceStatus, data.aheadOrBehindByDays) : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold border-neutral-200/70 dark:border-white/[0.07] bg-white dark:bg-white/10 hover:bg-neutral-50 dark:hover:bg-white/20 transition-all duration-300"
        >
          <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <span>Combined Pacing</span>
          {data?.hasSelection && status && (
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.dotClass}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dotClass}`}></span>
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Calendar className="w-5 h-5 text-primary" />
            Combined Pacing Planner
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center text-sm text-neutral-500">
            Loading combined pacing information...
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm mb-4">
            Failed to load combined pacing details: {error}
          </div>
        )}

        {/* Existing Combined Plan Summary */}
        {!isLoading && data?.hasSelection && (
          <div className="space-y-4 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl p-4 bg-neutral-50/30 dark:bg-neutral-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Current Combined Pacing Plan
              </span>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-3.5 h-3.5" />
                Clear Plan
              </button>
            </div>

            {/* Status Banner */}
            {status && (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${status.bgClass}`}>
                <div className="mt-0.5">{status.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      Combined Status
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.badgeClass}`}>
                      {status.badgeText}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {status.desc}
                  </p>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl bg-white/50 dark:bg-black/20 flex flex-col justify-between min-h-[80px]">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Days Left</span>
                <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{data.daysLeft}</span>
                <span className="text-[9px] text-neutral-500">remaining</span>
              </div>
              <div className="p-3 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl bg-white/50 dark:bg-black/20 flex flex-col justify-between min-h-[80px]">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Workload</span>
                <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                  {data.totalEffortMinutesRemaining} <span className="text-xs font-medium text-neutral-500">mins</span>
                </span>
                <span className="text-[9px] text-neutral-500">effort left</span>
              </div>
              <div className="p-3 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl bg-white/50 dark:bg-black/20 flex flex-col justify-between min-h-[80px]">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Daily Pace</span>
                <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                  {data.requiredMinutesPerDay} <span className="text-xs font-medium text-neutral-500">mins/d</span>
                </span>
                <span className="text-[9px] text-neutral-500">needed</span>
              </div>
            </div>

            {/* Target row */}
            <div className="flex items-center justify-between py-2 border-t border-b border-neutral-100 dark:border-neutral-800/60 my-2">
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span>Deadline: </span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {format(new Date(data.targetCompletionDate!), 'EEE, MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Courses list with workload share */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                Workload Share Breakdown
              </span>
              <div className="space-y-2 bg-white/30 dark:bg-black/10 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl p-3">
                {data.courses.map((course: any) => (
                  <div key={course.courseId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[70%]">
                        {course.courseName}
                      </span>
                      <span className="text-neutral-500">
                        {course.effortMinutesRemaining}m ({Math.round(course.shareOfTotal * 100)}%)
                      </span>
                    </div>
                    <div className="bg-neutral-100 dark:bg-white/10 rounded-full w-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary rounded-full h-full transition-all duration-500"
                        style={{ width: `${Math.round(course.shareOfTotal * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Picker and Setup Form */}
        {!isLoading && (
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                1. Select Enrolled Courses to Group
              </span>
              {activeEnrollments.length === 0 ? (
                <div className="text-center p-6 border border-dashed rounded-xl text-muted-foreground text-sm">
                  No active course enrollments available for pacing.
                </div>
              ) : (
                <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 space-y-2.5 max-h-[160px] overflow-y-auto bg-white dark:bg-black/10">
                  {activeEnrollments.map(enrollment => {
                    const courseId = bufferToHex(enrollment.courseId);
                    const versionId = bufferToHex(enrollment.courseVersionId);
                    const cohortId = enrollment.cohortId ? bufferToHex(enrollment.cohortId) : '';
                    const key = `${courseId}:${versionId}:${cohortId}`;
                    const isChecked = selectedCourses.includes(key);

                    return (
                      <div
                        key={key}
                        onClick={() => handleToggleCourse(key)}
                        className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-white/[0.04] rounded-lg cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleCourse(key)}
                          onClick={(e) => e.stopPropagation()} // avoid double toggle
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {enrollment.course?.name || 'Course'}
                          </p>
                          {enrollment.cohortName && (
                            <p className="text-[10px] text-muted-foreground">
                              {enrollment.cohortName}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                2. Choose Shared Completion Target Date
              </span>
              <Input
                type="date"
                value={targetDateInput}
                onChange={(e) => {
                  setValidationError('');
                  setTargetDateInput(e.target.value);
                }}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="rounded-xl border-neutral-300 dark:border-neutral-800"
              />
            </div>

            {validationError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-primary text-primary-foreground font-semibold rounded-xl"
                disabled={selectedCourses.length === 0 || !targetDateInput}
              >
                Save Combined Target
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
