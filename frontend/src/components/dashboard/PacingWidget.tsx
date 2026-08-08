import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePacingPlan, useSetPacingTarget } from '@/hooks/usePacing';
import { format } from 'date-fns';
import { Calendar, X, ChevronDown, AlertCircle, CheckCircle2, HelpCircle, Award } from 'lucide-react';

interface PacingWidgetProps {
  courseId: string;
  versionId: string;
  cohortId?: string;
}

export function PacingWidget({ courseId, versionId, cohortId }: PacingWidgetProps) {
  const [useTeacherDeadline, setUseTeacherDeadline] = useState(false);
  const { data, isLoading, error } = usePacingPlan(courseId, versionId, cohortId, useTeacherDeadline);
  const setPacingTarget = useSetPacingTarget();
  const [dismissedBehindBanner, setDismissedBehindBanner] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [isModulesExpanded, setIsModulesExpanded] = useState(false);

  useEffect(() => {
    if (data?.targetCompletionDate) {
      setDateInput(format(new Date(data.targetCompletionDate), 'yyyy-MM-dd'));
    }
  }, [data?.targetCompletionDate]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="font-semibold text-neutral-800 dark:text-neutral-200">Failed to load pacing data</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
        No pacing data available.
      </div>
    );
  }

  const {
    hasTarget,
    targetCompletionDate,
    teacherDeadline,
    itemsRemaining,
    effortMinutesRemaining,
    daysLeft,
    itemsPerDay,
    requiredMinutesPerDay,
    isOverdue,
    paceStatus,
    aheadOrBehindByDays,
    suggestedCatchUpDate,
    moduleBreakdown,
  } = data as any;

  const saveTarget = (dateStr: string) => {
    if (!dateStr) return;
    const date = new Date(dateStr);
    setPacingTarget.mutate({
      params: {
        path: { courseId, versionId } as any
      },
      body: {
        targetCompletionDate: date.toISOString()
      }
    } as any);
  };

  const handleClear = () => {
    setPacingTarget.mutate({
      params: {
        path: { courseId, versionId } as any
      },
      body: {
        targetCompletionDate: null
      }
    } as any);
    setDateInput('');
  };

  // Helper to format pace status banner
  const getPaceStatusDetails = () => {
    switch (paceStatus) {
      case 'ahead':
        return {
          title: 'PACE STATUS',
          badgeText: 'Ahead',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30',
          desc: `${aheadOrBehindByDays} days ahead of schedule. Great job!`,
          bgClass: 'bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        };
      case 'behind':
        return {
          title: 'PACE STATUS',
          badgeText: 'Behind',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30',
          desc: `${Math.abs(aheadOrBehindByDays)} days behind schedule.`,
          bgClass: 'bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20',
          icon: <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        };
      case 'on_track':
        return {
          title: 'PACE STATUS',
          badgeText: 'On Track',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30',
          desc: 'You are perfectly on track to complete the course.',
          bgClass: 'bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20',
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        };
      case 'no_data':
      default:
        return {
          title: 'PACE STATUS',
          badgeText: 'No Activity',
          badgeClass: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200/50 dark:border-neutral-700/50',
          desc: 'Not enough study history to determine pacing yet.',
          bgClass: 'bg-neutral-50/30 dark:bg-neutral-900/10 border border-neutral-100 dark:border-neutral-800/40',
          icon: <HelpCircle className="w-4 h-4 text-neutral-500" />
        };
    }
  };

  const statusDetails = getPaceStatusDetails();

  return (
    <div className="space-y-5 p-1">
      {teacherDeadline && (
        <div className="space-y-3">
          <div className="p-3.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/15 dark:border-indigo-500/30 rounded-2xl flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="font-medium">🏁 Official Course Deadline (Teacher):</span>
            </div>
            <span className="font-semibold bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
              {format(new Date(teacherDeadline), 'PPP')}
            </span>
          </div>
          <div className="flex items-center justify-between p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 text-xs">
            <button
              onClick={() => setUseTeacherDeadline(false)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all duration-200 cursor-pointer text-center border-none bg-transparent ${!useTeacherDeadline
                ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Personal Target
            </button>
            <button
              onClick={() => setUseTeacherDeadline(true)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all duration-200 cursor-pointer text-center border-none bg-transparent ${useTeacherDeadline
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Course Deadline
            </button>
          </div>
        </div>
      )}

      {/* If target is set & not completed */}
      {hasTarget && itemsRemaining > 0 && (
        <div className="space-y-4">
          {/* Pace status banner */}
          <div className={`p-4 rounded-2xl flex items-start gap-3 ${statusDetails.bgClass}`}>
            <div className="mt-0.5">{statusDetails.icon}</div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  {statusDetails.title}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusDetails.badgeClass}`}>
                  {statusDetails.badgeText}
                </span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {statusDetails.desc}
              </p>
            </div>
          </div>

          {/* Core Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Days Left */}
            <div className="p-4 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[96px]">
              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Days Left
              </span>
              <span className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {daysLeft}
              </span>
              <span className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-1">
                days remaining
              </span>
            </div>

            {/* Effort Left */}
            <div className="p-4 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[96px]">
              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Effort Left
              </span>
              <span className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                {Math.round(effortMinutesRemaining)} <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">mins</span>
              </span>
              <span className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-1">
                ({itemsRemaining} items)
              </span>
            </div>

            {/* Daily Pace */}
            <div className="p-4 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[96px]">
              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Daily Pace
              </span>
              <span className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                {Math.round(requiredMinutesPerDay)} <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">mins/d</span>
              </span>
              <span className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-1">
                ({itemsPerDay} items/d)
              </span>
            </div>
          </div>

          {/* Target row */}
          <div className="flex items-center justify-between py-3 border-t border-b border-neutral-100 dark:border-neutral-800/60 my-2">
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <span>{useTeacherDeadline ? "Course Deadline:" : "Target:"} </span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                {format(new Date(targetCompletionDate), 'EEE, MMM d, yyyy')}
              </span>
            </div>
            {useTeacherDeadline ? (
              <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/10">
                Set by Instructor
              </span>
            ) : (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors cursor-pointer border-none bg-transparent"
              >
                <X className="w-3.5 h-3.5" />
                Clear Target
              </button>
            )}
          </div>

          {/* Modules accordion */}
          {moduleBreakdown && moduleBreakdown.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setIsModulesExpanded(!isModulesExpanded)}
                className="flex items-center justify-between w-full p-3 font-bold text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900/40 rounded-xl hover:bg-neutral-100/50 dark:hover:bg-neutral-900 transition-all border border-neutral-200/50 dark:border-neutral-800/50 uppercase tracking-wider"
              >
                <span>By Module ({moduleBreakdown.length})</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isModulesExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isModulesExpanded && (
                <div className="p-3 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl bg-neutral-50/10 dark:bg-neutral-950/10 divide-y divide-neutral-100 dark:divide-neutral-800/40 max-h-[220px] overflow-y-auto">
                  {moduleBreakdown.map((mod: any) => (
                    <div key={mod.moduleId} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-start gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-xs text-neutral-800 dark:text-neutral-200 truncate" title={mod.moduleName}>
                            {mod.moduleName}
                          </p>
                          {mod.difficulty && (
                            <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${mod.difficulty === 'easy'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                              : mod.difficulty === 'moderate'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                              }`}>
                              {mod.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {mod.itemsRemaining} items left • {Math.round(mod.effortMinutesRemaining)} mins
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {mod.itemsRemaining === 0 ? (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400">
                            Completed
                          </span>
                        ) : mod.suggestedFinishByDate ? (
                          <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                            Finish by {format(new Date(mod.suggestedFinishByDate), 'MMM d')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Behind banner alert */}
          {paceStatus === 'behind' && !dismissedBehindBanner && suggestedCatchUpDate && (
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 text-amber-900 dark:text-amber-300 mt-4 flex flex-col gap-3">
              <p className="text-xs leading-relaxed font-medium">
                It looks like you&apos;re falling behind. Would you like to adjust your target completion date to match your actual study speed?
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setPacingTarget.mutate({
                    params: { path: { courseId, versionId } as any },
                    body: { targetCompletionDate: new Date(suggestedCatchUpDate).toISOString() }
                  } as any)}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] h-8"
                >
                  Push target to {format(new Date(suggestedCatchUpDate), 'MMM d, yyyy')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDismissedBehindBanner(true)}
                  className="border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 rounded-xl text-[11px] h-8 text-neutral-700 dark:text-neutral-300"
                >
                  Keep target
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* If course is completed */}
      {hasTarget && itemsRemaining === 0 && (
        <div className="p-6 text-center space-y-3">
          <Award className="w-12 h-12 text-yellow-500 mx-auto animate-bounce" />
          <p className="font-bold text-lg text-neutral-800 dark:text-neutral-100">Congratulations!</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">You have completed all items in this course.</p>
          <Button variant="outline" onClick={handleClear} className="mx-auto rounded-xl">
            Clear Target
          </Button>
        </div>
      )}

      {/* If no target is set */}
      {!hasTarget && (
        <div className="space-y-4">
          <div className="p-4 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl text-center space-y-3">
            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">
                No Target Completion Date Set
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[280px] mx-auto">
                Set a target date to get a personalized pacing schedule, suggested finish dates per module, and study pace tracking.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
              Choose Target Completion Date
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="rounded-xl border-neutral-300 dark:border-neutral-800"
              />
              <Button
                onClick={() => saveTarget(dateInput)}
                disabled={!dateInput}
                className="bg-primary text-primary-foreground font-semibold rounded-xl"
              >
                Save
              </Button>
            </div>
          </div>

          <div className="p-4 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-neutral-50/20 dark:bg-neutral-900/10 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
              Remaining Work
            </span>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {Math.round(effortMinutesRemaining)} mins <span className="text-neutral-500 dark:text-neutral-400 font-normal">of remaining effort</span> • {itemsRemaining} items <span className="text-neutral-500 dark:text-neutral-400 font-normal">remaining</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
