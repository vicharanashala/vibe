import { useState, useEffect } from "react";
import { useCoursePacingOverview } from "@/hooks/usePacingTeacher";
import { X, Loader2, Target, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUpdateCourseVersion } from "@/hooks/hooks";
import { toast } from "sonner";

interface PacingOverviewPanelProps {
  courseId: string;
  versionId: string;
}

export function PacingOverviewPanel({ courseId, versionId }: PacingOverviewPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error, refetch } = useCoursePacingOverview(courseId, versionId, isOpen);

  const updateVersionMutation = useUpdateCourseVersion();
  const [deadlineInput, setDeadlineInput] = useState<string>("");
  const [isUpdatingDeadline, setIsUpdatingDeadline] = useState(false);

  const formatDateForInput = (dateStr?: string | Date | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    if (data?.teacherDeadline !== undefined) {
      setDeadlineInput(formatDateForInput(data.teacherDeadline));
    }
  }, [data?.teacherDeadline]);

  const handleSaveDeadline = async () => {
    try {
      setIsUpdatingDeadline(true);
      await updateVersionMutation.mutateAsync({
        params: { path: { courseId, versionId } },
        body: {
          teacherDeadline: deadlineInput ? new Date(deadlineInput).toISOString() : (null as any),
        } as any,
      });
      toast.success("Shared course deadline updated successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update deadline");
    } finally {
      setIsUpdatingDeadline(false);
    }
  };

  const handleClearDeadline = async () => {
    try {
      setIsUpdatingDeadline(true);
      await updateVersionMutation.mutateAsync({
        params: { path: { courseId, versionId } },
        body: {
          teacherDeadline: null as any,
        } as any,
      });
      setDeadlineInput("");
      toast.success("Shared course deadline removed successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove deadline");
    } finally {
      setIsUpdatingDeadline(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "ahead":
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Ahead</Badge>;
      case "on_track":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">On Track</Badge>;
      case "behind":
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">Behind</Badge>;
      case "no_data":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">No Data Yet</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">No Target Set</Badge>;
    }
  };

  return (
    <>
      {/* Trigger Card/Button */}
      <Card
        className="border border-border shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 hover:border-primary/20 bg-card group"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">🎯 Pacing Overview</p>
              <p className="text-sm text-card-foreground mt-1">
                Click to view pacing details for all active students.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-primary group-hover:underline">
              View Pacing Plans &rarr;
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Floating Dialog / Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Card */}
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-card-foreground">Course Pacing Overview</h2>
                <p className="text-sm text-muted-foreground">Aggregated target pacing plans for enrolled students.</p>
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
                <p className="text-muted-foreground text-sm">Loading aggregated pacing data...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-red-500/10 text-red-600 rounded-xl text-center">
                Failed to load course pacing overview. Please try again.
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Teacher Deadline Configuration */}
                <div className="p-5 border border-border bg-muted/10 rounded-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Calendar className="h-4.5 w-4.5 text-primary" />
                        Shared Course Deadline
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Set a global course deadline for all students. Individual student pacing plans in administrative dashboards will be calculated based on this deadline.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="bg-background border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary w-40"
                        value={deadlineInput}
                        onChange={(e) => setDeadlineInput(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={isUpdatingDeadline}
                        onClick={handleSaveDeadline}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isUpdatingDeadline ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Save
                      </Button>
                      {data.teacherDeadline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearDeadline}
                          disabled={isUpdatingDeadline}
                          className="h-8 px-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {data.teacherDeadline && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-background border border-border/40 px-3 py-2 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>
                        Current active course deadline:{" "}
                        <strong className="text-foreground text-sm">
                          {new Date(data.teacherDeadline).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Category Labeled Counts */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-xs font-medium text-muted-foreground">Behind</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.behindCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Needs catch-up</p>
                  </div>

                  <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">On Track</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.onTrackCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">On schedule</p>
                  </div>

                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-medium text-muted-foreground">Ahead</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.aheadCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Ahead of schedule</p>
                  </div>

                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-medium text-muted-foreground">No Data</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.noDataCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Not enough activity</p>
                  </div>

                  <div className="p-4 bg-muted/30 border border-border rounded-xl col-span-2 md:col-span-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                      <span className="text-xs font-medium text-muted-foreground">No Target</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.noTargetSetCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">No date set yet</p>
                  </div>
                </div>

                {/* Explanatory descriptions */}
                <div className="p-4 bg-muted/20 border border-border rounded-lg text-xs text-muted-foreground space-y-1">
                  <p>💡 <strong className="text-foreground">About pacing:</strong></p>
                  <p>&bull; <strong className="text-foreground">Ahead:</strong> students moving faster than their target pace requires.</p>
                  <p>&bull; <strong className="text-foreground">On track:</strong> students on pace to hit their target date.</p>
                  <p>&bull; <strong className="text-foreground">Behind:</strong> students who need to speed up or push their deadline.</p>
                  <p>&bull; <strong className="text-foreground">No data yet:</strong> target is set but not enough recent activity to judge pace.</p>
                  <p>&bull; <strong className="text-foreground">No target set:</strong> student has not set a target completion date yet.</p>
                </div>

                {/* Students list */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-card-foreground">Student Breakdown (Sorted by Status)</h3>
                  {data.students.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                      No active students found in this course version.
                    </p>
                  ) : (
                    <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
                      {data.students.map((student) => (
                        <div key={student.userId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{student.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ID: {student.userId}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">Pace:</span>
                              {getStatusBadge(student.paceStatus)}
                            </div>

                            {student.hasTarget && student.paceStatus !== "no_data" && (
                              <div className="text-xs md:text-sm font-medium">
                                {student.aheadOrBehindByDays !== null && (
                                  <span className={student.aheadOrBehindByDays < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                                    {student.aheadOrBehindByDays < 0
                                      ? `${Math.abs(student.aheadOrBehindByDays)} days behind`
                                      : `${student.aheadOrBehindByDays} days ahead`}
                                  </span>
                                )}
                              </div>
                            )}

                            {student.hasTarget && (
                              <div className="text-xs text-muted-foreground">
                                Req: <span className="font-medium text-foreground">{student.requiredMinutesPerDay ?? 0}m/day</span>
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                              Remaining: <span className="font-medium text-foreground">{student.itemsRemaining} items</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
