import { Clock, Info, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/utils/utils";

/**
 * Lightweight "at a glance" course details shown as a dialog.
 *
 * This is the content that previously lived on the flipped back-side of the
 * CourseCard. It is now an overlay so the grid never reflows (no layout shift),
 * and the heavy 3D transform on every card is gone.
 *
 * Heavier, fully-detailed stats live in <EnrollmentDetailsDialog/> ("Full Details").
 */
export interface CourseQuickDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

  // Display data (already derived by the parent card — kept identical).
  courseName: string;
  description?: string;
  versionLabel: string;
  cohortName?: string;
  totalLessons: number;
  moduleCount: number;
  sectionCount: number;
  videoCount: number;
  quizCount: number;
  articleCount: number;
  projectCount: number;
  timeslotStr: string;
  hasTimeslot: boolean;

  // Action state + handlers (behaviour preserved exactly).
  variant?: string;
  isStart?: boolean;
  isCompleted?: boolean;
  isTimeslotActive?: boolean;
  hasAssignedTimeslot?: boolean;
  continueLabel: string;
  onContinue: () => void;
  onFullDetails: () => void;
  onTimeslot: () => void;
}

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-bold text-foreground">{value}</span>
  </div>
);

export function CourseQuickDetailsDialog({
  isOpen,
  onOpenChange,
  courseName,
  description,
  versionLabel,
  cohortName,
  totalLessons,
  moduleCount,
  sectionCount,
  videoCount,
  quizCount,
  articleCount,
  projectCount,
  timeslotStr,
  hasTimeslot,
  variant = "dashboard",
  isStart = false,
  isCompleted = false,
  isTimeslotActive = false,
  hasAssignedTimeslot = false,
  continueLabel,
  onContinue,
  onFullDetails,
  onTimeslot,
}: CourseQuickDetailsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 w-full max-w-md max-h-[85vh] overflow-hidden rounded-[24px]">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="text-left text-foreground text-lg">{courseName}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            <div>
              <h4 className="flex items-center gap-1.5 mb-1 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                <Info className="w-3 h-3" /> Description
              </h4>
              <p className="text-foreground/80 text-xs leading-relaxed">
                {description || "No description available for this course. Explore our structured curriculum designed to accelerate your learning journey."}
              </p>
            </div>

            <div className="gap-3 grid grid-cols-1 py-3 border-slate-100 border-y dark:border-slate-800">
              <Stat label="Version" value={versionLabel} />
              {cohortName && <Stat label="Cohort" value={cohortName} />}

              <div className="gap-x-4 gap-y-2 grid grid-cols-2 pt-1">
                <Stat label="Total Items" value={totalLessons} />
                <Stat label="Modules" value={moduleCount} />
                <Stat label="Sections" value={sectionCount} />
                <Stat label="Videos" value={videoCount} />
                {quizCount > 0 && <Stat label="Quizzes" value={quizCount} />}
                {articleCount > 0 && <Stat label="Articles" value={articleCount} />}
                {projectCount > 0 && <Stat label="Projects" value={projectCount} />}
              </div>

              <div className="flex justify-between items-center mt-1 pt-2 border-slate-50 dark:border-slate-800/50 border-t text-xs">
                <span className="flex items-center gap-1 font-medium text-muted-foreground">
                  <Clock className="w-3 h-3" /> Timeslot
                </span>
                <span className={cn(
                  "max-w-[160px] font-bold truncate text-right",
                  hasTimeslot ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {timeslotStr}
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 space-y-3 px-6 pt-4 pb-6 border-slate-100 dark:border-slate-800 border-t">
          {variant !== 'available' && (
            <div className={cn("gap-3 grid", isTimeslotActive ? "grid-cols-2" : "grid-cols-1")}>
              <Button
                variant="outline"
                className="border-2 rounded-lg w-full h-9 font-bold text-[11px]"
                onClick={onFullDetails}
              >
                <Info className="mr-1 w-3.5 h-3.5 text-blue-500" />
                Full Details
              </Button>
              {isTimeslotActive && (
                <Button
                  variant="outline"
                  className="border-2 rounded-lg w-full h-9 font-bold text-[11px]"
                  onClick={onTimeslot}
                >
                  <Clock className="mr-1 w-3.5 h-3.5 text-green-500" />
                  Pick Slot
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={onContinue}
            className={cn(
              "flex justify-center items-center gap-2 shadow-md rounded-xl w-full h-10 font-bold text-xs active:scale-95 transition-all duration-300",
              variant === 'available' ? "bg-primary text-primary-foreground" : isStart ? "bg-[#22C55E] text-white" : "bg-[#FACC15] text-black"
            )}
          >
            {continueLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
