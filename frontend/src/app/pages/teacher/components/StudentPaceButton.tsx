import { useState } from "react";
import { useStudentPacingDetail } from "@/hooks/usePacingTeacher";
import { Calendar, X, Loader2, Target, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface StudentPaceButtonProps {
  studentUserId: string;
  courseId: string;
  versionId: string;
  cohortId?: string;
}

export function StudentPaceButton({ studentUserId, courseId, versionId, cohortId }: StudentPaceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error } = useStudentPacingDetail(courseId, versionId, studentUserId, cohortId, isOpen);

  const getPaceStatusDetails = (paceStatus: string, aheadOrBehindByDays: number | null) => {
    switch (paceStatus) {
      case "ahead":
        return {
          title: "PACE STATUS",
          badgeText: "Ahead",
          badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30",
          desc: `${aheadOrBehindByDays} days ahead of schedule.`,
          bgClass: "bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20",
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        };
      case "behind":
        return {
          title: "PACE STATUS",
          badgeText: "Behind",
          badgeClass: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-900/30",
          desc: `${Math.abs(aheadOrBehindByDays || 0)} days behind schedule.`,
          bgClass: "bg-red-50/30 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20",
          icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
        };
      case "on_track":
        return {
          title: "PACE STATUS",
          badgeText: "On Track",
          badgeClass: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border border-green-200/50 dark:border-green-900/30",
          desc: "Perfectly on track to complete the course.",
          bgClass: "bg-green-50/30 dark:bg-green-950/10 border border-green-100 dark:border-green-900/20",
          icon: <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
        };
      case "no_data":
      default:
        return {
          title: "PACE STATUS",
          badgeText: "No Activity",
          badgeClass: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200/50 dark:border-neutral-700/50",
          desc: "Not enough study history to determine pacing yet.",
          bgClass: "bg-neutral-50/30 dark:bg-neutral-900/10 border border-neutral-100 dark:border-neutral-800/40",
          icon: <HelpCircle className="w-4 h-4 text-neutral-500" />
        };
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-200 cursor-pointer"
      >
        <Target className="h-4 w-4 mr-2" />
        Pacing
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-card-foreground">Student Pacing Plan</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Loading student pacing details...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-red-500/10 text-red-600 rounded-xl text-center">
                Failed to load student pacing plan. Please try again.
              </div>
            ) : data ? (
              <div className="space-y-5">
                {!data.hasTarget ? (
                  <div className="p-6 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl text-center space-y-3">
                    <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">
                      No Pacing Target Set
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[280px] mx-auto">
                      Student hasn't set a target completion date yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Status Banner */}
                    {(() => {
                      const status = getPaceStatusDetails(data.paceStatus, data.aheadOrBehindByDays);
                      return (
                        <div className={`p-4 rounded-xl flex items-start gap-3 ${status.bgClass}`}>
                          <div className="mt-0.5">{status.icon}</div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                {status.title}
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
                      );
                    })()}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[80px]">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Days Left</span>
                        <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{data.daysLeft}</span>
                        <span className="text-[9px] text-neutral-500">remaining</span>
                      </div>
                      <div className="p-3 border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[80px]">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Workload</span>
                        <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                          {Math.round(data.effortMinutesRemaining)} <span className="text-xs font-medium text-neutral-500">mins</span>
                        </span>
                        <span className="text-[9px] text-neutral-500">({data.itemsRemaining} items)</span>
                      </div>
                      <div className="p-3 border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl bg-neutral-50/30 dark:bg-neutral-950/20 flex flex-col justify-between min-h-[80px]">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Daily Pace</span>
                        <span className="text-xl font-bold text-neutral-800 dark:text-neutral-100 truncate">
                          {Math.round(data.requiredMinutesPerDay)} <span className="text-xs font-medium text-neutral-500">m/d</span>
                        </span>
                        <span className="text-[9px] text-neutral-500">({data.itemsPerDay} items/d)</span>
                      </div>
                    </div>

                    {/* Deadline target */}
                    <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 py-2 border-t border-b border-neutral-100 dark:border-neutral-800/60">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      <span>Target Deadline: </span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {format(new Date(data.targetCompletionDate!), "EEE, MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Module breakdown */}
                    {data.moduleBreakdown && data.moduleBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                          Module Breakdown
                        </span>
                        <div className="border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl p-3 divide-y divide-neutral-100 dark:divide-neutral-800/40 bg-neutral-50/10 max-h-[180px] overflow-y-auto">
                          {data.moduleBreakdown.map((mod: any) => (
                            <div key={mod.moduleId} className="py-2 first:pt-0 last:pb-0 flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-medium text-xs text-neutral-800 dark:text-neutral-200 truncate">
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
                                <p className="text-[10px] text-neutral-500">
                                  {mod.itemsRemaining} items left • {Math.round(mod.effortMinutesRemaining)} mins
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {mod.itemsRemaining === 0 ? (
                                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                    Completed
                                  </span>
                                ) : mod.suggestedFinishByDate ? (
                                  <span className="text-[10px] font-medium text-neutral-600">
                                    Finish by {format(new Date(mod.suggestedFinishByDate), "MMM d")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
