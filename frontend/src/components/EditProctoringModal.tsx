import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useBackfillFollowUpInvites, useCourseVersionById, useEditProctoringSettings, useGetProcotoringSettings, useUpdateFollowUpInvite, useUserEnrollments } from "@/hooks/hooks"
import { bufferToHex } from "@/utils/helpers"
import { useEffect, useMemo, useState } from "react"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import { Switch } from "./ui/switch"
import { toast } from "sonner"
import { ChevronDown, Loader2 } from "lucide-react"
import { Input } from "./ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

enum ProctoringComponent {
  CAMERAMICRO = 'cameraMic',
  BLURDETECTION = 'blurDetection',
  FACECOUNTDETECTION = 'faceCountDetection',
  HANDGESTUREDETECTION = 'handGestureDetection',
  VOICEDETECTION = 'voiceDetection',
  VIRTUALBACKGROUNDDETECTION = 'virtualBackgroundDetection',
  RIGHTCLICKDISABLED = 'rightClickDisabled',
  FACERECOGNITION = 'faceRecognition',
}

// Throw-safe id conversion: ObjectIds may serialize as a hex string or a
// buffer-like object depending on the endpoint. Never throw (a throw here would
// break the whole dropdown list).
const normalizeId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return bufferToHex(value);
  } catch {
    const s = value?.toString?.();
    return s && s !== "[object Object]" ? s : "";
  }
};

// Resolves a course version's faculty-entered name/number for display in the
// dropdown. The enrollments payload only carries version IDs, so each option
// fetches its own version (react-query caches, so this is cheap).
function VersionLabel({ versionId }: { versionId: string }) {
  const { data } = useCourseVersionById(versionId, true);
  return <>{data?.version ?? `Version ${versionId.slice(-6)}`}</>;
}

const labelMap: Record<string, string> = {
  cameraMic: "Camera + Microphone",
  blurDetection: "Blur Detection",
  faceCountDetection: "Face Count Detection",
  handGestureDetection: "Hand Gesture Detection",
  voiceDetection: "Voice Detection",
  virtualBackgroundDetection: "Virtual Background Detection",
  rightClickDisabled: "Right Click Disabled",
  faceRecognition: "Face Recognition",
}

export function ProctoringModal({
  open,
  onClose,
  courseId,
  courseVersionId,
  isNew,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  courseId: string
  courseVersionId: string
  isNew: boolean
  onSuccess?: ()=> void
}) {
  const { editSettings, loading, error } = useEditProctoringSettings()
  const { getSettings, settingLoading, settingError } = useGetProcotoringSettings();
  const { updateFollowUpInvite, loading: followUpLoading } = useUpdateFollowUpInvite();
  const { backfillFollowUpInvites, loading: backfillLoading } = useBackfillFollowUpInvites();

  const allComponents = Object.values(ProctoringComponent)
  const [detectors, setDetectors] = useState(
    allComponents.map((name) => ({ name, enabled: false }))
  )
  const [linearProgressionEnabled, setLinearProgressionEnabled] = useState(true);
  const [seekForwardEnabled, setSeekForwardEnabled] = useState(false);
  const [hpSystemEnabled, setHpSystemEnabled] = useState(false);
  const [baseHp, setbaseHp] = useState<number>(0);
  const [isPublic, setIsPublic] = useState(false);
  const [isAdditionalSettingsExpanded, setIsAdditionalSettingsExpanded] = useState(false);
  const [enableRandomize, setEnableRandomize] = useState<boolean>(false);
  const [crowdsourcedQuestionSubmissionEnabled, setCrowdsourcedQuestionSubmissionEnabled] = useState(false);
  const { data: courseVersion, isLoading: versionLoading } = useCourseVersionById(courseVersionId || "")

  // Follow-up invite: when a student completes this course, auto-create an
  // exclusive invite to the configured follow-up course.
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpCourseId, setFollowUpCourseId] = useState("");
  const [followUpVersionId, setFollowUpVersionId] = useState("");
  const [followUpCohortId, setFollowUpCohortId] = useState<string>("");
  const { data: followUpVersion, isLoading: followUpVersionLoading } =
    useCourseVersionById(followUpVersionId || "", !!followUpVersionId);
  const followUpCohorts = followUpVersion?.cohortDetails ?? [];
  const followUpRequiresCohort = followUpEnabled && followUpCohorts.length > 0;

  // Courses the instructor teaches — used to populate the follow-up dropdowns
  // (so they never deal with raw IDs). The basic enrollments endpoint reliably
  // lists the instructor's courses (same source as the dashboard) along with
  // each course's active version IDs. Version *names* are resolved per-version
  // via <VersionLabel> (see component) since the enrollments payload only
  // carries version IDs.
  const { data: basicEnrollments } = useUserEnrollments(
    1,
    100,
    open,
    "",
    "INSTRUCTOR",
    "active",
  );

  // De-duplicate the instructor's courses into { id, name, versionIds }.
  const followUpCourseOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; versionIds: string[] }>();
    for (const e of basicEnrollments?.enrollments ?? []) {
      const id = normalizeId(e.courseId);
      if (!id || byId.has(id)) continue;
      const versionIds = ((e.course as any)?.versions ?? [])
        .map((v: any) => normalizeId(v))
        .filter(Boolean);
      byId.set(id, {
        id,
        name: (e.course as any)?.name ?? "Untitled course",
        versionIds,
      });
    }
    return Array.from(byId.values()).filter(c => c.id);
  }, [basicEnrollments]);
  const followUpVersionIds =
    followUpCourseOptions.find(c => c.id === followUpCourseId)?.versionIds ?? [];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await getSettings(courseId, courseVersionId);
        if (result) {
          setDetectors(result.settings?.proctors?.detectors?.map((d: any) => ({ name: d.detectorName, enabled: d.settings.enabled })))
          setLinearProgressionEnabled(result.settings?.linearProgressionEnabled)
          setSeekForwardEnabled(result.settings?.seekForwardEnabled ?? false)
          setIsPublic(result.settings?.isPublic ?? false)
          setHpSystemEnabled(result.settings?.hpSystem ?? false)
          setbaseHp(result.settings?.baseHp ?? 0)
          setEnableRandomize(result.settings?.randomizeItems ?? false)
          setCrowdsourcedQuestionSubmissionEnabled(
            result.settings?.crowdsourcedQuestionSubmissionEnabled ?? false,
          )
          const followUp = result.settings?.followUpInvite;
          setFollowUpEnabled(followUp?.enabled ?? false)
          // ObjectIds arrive from the API as buffer objects, so normalize them
          // the same way the dropdown options are (normalizeId/bufferToHex).
          // Using a raw .toString() here yields "[object Object]", which never
          // matches a <SelectItem> value, leaving the dropdowns blank on reload.
          setFollowUpCourseId(normalizeId(followUp?.courseId))
          setFollowUpVersionId(normalizeId(followUp?.courseVersionId))
          setFollowUpCohortId(normalizeId(followUp?.cohortId))
        }
      } catch (err) {
        console.error("Failed to fetch proctoring settings:", err)
      }
    }

    if (open) {
      fetchSettings()
    }
  }, [open])

  const toggle = (name: string) => {
    setDetectors((prev) =>  
      prev.map((d) =>
        d.name === name ? { ...d, enabled: !d.enabled } : d
      )
    )
  }

  const handleSubmit = async () => {
    // Validate the follow-up invite configuration up front so misconfiguration
    // is surfaced to the instructor before anything is saved.
    if (followUpEnabled) {
      if (!followUpCourseId.trim() || !followUpVersionId.trim()) {
        toast.error("Please select the follow-up course and version.")
        return
      }
      if (followUpRequiresCohort && !followUpCohortId) {
        toast.error("The follow-up course uses cohorts. Please select a cohort.")
        return
      }
    }

    try {
      const result = await editSettings(courseId, courseVersionId, detectors, isNew, linearProgressionEnabled, seekForwardEnabled, isPublic, hpSystemEnabled, baseHp, enableRandomize, crowdsourcedQuestionSubmissionEnabled)

      // Persist the follow-up invite configuration (separate endpoint).
      await updateFollowUpInvite(courseId, courseVersionId, {
        enabled: followUpEnabled,
        courseId: followUpEnabled ? followUpCourseId.trim() : undefined,
        courseVersionId: followUpEnabled ? followUpVersionId.trim() : undefined,
        cohortId: followUpEnabled && followUpCohortId ? followUpCohortId : undefined,
      })

      if (result != undefined) {
        onSuccess?.();
        onClose();
      }
      toast.success("Settings updated!")
    } catch(error: any) {
      // Show the backend's actionable message when available (e.g. cohort prompt).
      toast.error(error?.message || "Failed to update settings!")
    }
  }

  // Re-send the follow-up invite to students who already completed this course
  // before the invite was configured. Uses the *saved* follow-up config, so the
  // instructor should save any pending changes first.
  const handleBackfill = async () => {
    try {
      const summary = await backfillFollowUpInvites(courseId, courseVersionId)
      const skipped = summary.alreadyEnrolled + summary.missingEmail
      toast.success(
        `Invited ${summary.invited} past completer${summary.invited === 1 ? "" : "s"}.` +
          (skipped > 0 ? ` Skipped ${skipped} (already enrolled or no email).` : ""),
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to send invites to past completers.")
    }
  }

  useEffect(() => {
    if (linearProgressionEnabled) {
      setEnableRandomize(false);
    }
  }, [linearProgressionEnabled]);

  if (settingLoading) {
    return <div>Loading...</div>
  }

  if ( versionLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground md:max-w-md max-w-sm max-[425px]:w-[90vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">Proctoring Settings</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 pt-4"
        >
          <div className="space-y-6">

            {/* Proctoring Controls Section */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">Proctoring Controls</h3>
                <p className="text-xs text-muted-foreground">Configure monitoring and detection features</p>
              </div>

<div className="space-y-3">
  {detectors.map((detector) => (
    detector.name === ProctoringComponent.BLURDETECTION ? (
      <div key={detector.name} className="flex items-center space-x-2">
        <Checkbox
          id={detector.name}
          checked={detector.enabled}
          disabled
        />
        <label
          htmlFor={detector.name}
          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {labelMap[detector.name] || detector.name}
        </label>
      </div>
    ) : (
      <div key={detector.name} className="flex items-center space-x-2">
        <Checkbox
          id={detector.name}
          checked={detector.enabled}
          onCheckedChange={() => toggle(detector.name)}
        />
        <label
          htmlFor={detector.name}
          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {labelMap[detector.name] || detector.name}
        </label>
      </div>
    )
  ))}
</div>
            </div>

            <Separator className="my-6" />

            {/* Additional Settings Section */}
            <div className="space-y-4">
              {/* Expandable Header */}
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setIsAdditionalSettingsExpanded(!isAdditionalSettingsExpanded)}
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground">Additional Settings</h3>
                  <p className="text-xs text-muted-foreground">Configure course behavior and progression</p>
                </div>
                <ChevronDown 
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    isAdditionalSettingsExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {/* Collapsible Content */}
              {isAdditionalSettingsExpanded && (
                <div className="space-y-4 pl-2 border-l-2 border-border">
                  <div className="flex items-center justify-between space-x-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Linear Course Progression</Label>
                      <p className="text-xs text-muted-foreground">Students must follow lessons sequentially</p>
                    </div>
                    <Switch checked={linearProgressionEnabled}
                     onCheckedChange={()=>setLinearProgressionEnabled(prev=>!prev)}
                     disabled 
                     />
                  </div>

                  <div className="flex items-center justify-between space-x-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Seek Forward</Label>
                      <p className="text-xs text-muted-foreground">Allow students to seek forward in all videos</p>
                    </div>
                    <Switch checked={seekForwardEnabled} onCheckedChange={()=>setSeekForwardEnabled(prev=>!prev)} />
                  </div>

                  {!(courseVersion?.cohortDetails?.length > 0) && (
                    <div className="flex items-center justify-between space-x-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Make Public</Label>
                        <p className="text-xs text-muted-foreground">Make this course available to all students</p>
                      </div>
                      <Switch checked={isPublic} onCheckedChange={() => setIsPublic(prev => !prev)} />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between space-x-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Hp System</Label>
                        <p className="text-xs text-muted-foreground">Enable HP system for this course</p>
                      </div>
                      <Switch checked={hpSystemEnabled} onCheckedChange={() => setHpSystemEnabled(prev => !prev)} />
                    </div>
                  </div>
                  {hpSystemEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Base HP</Label>
                      <p className="text-xs text-muted-foreground">
                        Set the base HP value for students
                      </p>
                      <Input
                        type="number"
                        value={baseHp}
                        min={0}
                        max={100}
                        onChange={(e) => setbaseHp(Number(e.target.value))}
                        placeholder="Enter base HP"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between space-x-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Randomize Content</Label>
                        <p className="text-xs text-muted-foreground">Shuffle content order for a unique student experience.</p>
                      </div>
                      <Switch checked={enableRandomize} disabled={linearProgressionEnabled} onCheckedChange={() => setEnableRandomize(prev => !prev)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between space-x-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Student Question Submission</Label>
                        <p className="text-xs text-muted-foreground">Allow students to submit a post-video MCQ before the next quiz.</p>
                      </div>
                      <Switch
                        checked={crowdsourcedQuestionSubmissionEnabled}
                        onCheckedChange={() =>
                          setCrowdsourcedQuestionSubmissionEnabled(prev => !prev)
                        }
                      />
                    </div>
                  </div>

                  {/* Follow-up course invite */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between space-x-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Follow-up Course Invite</Label>
                        <p className="text-xs text-muted-foreground">Send an exclusive invite to another course when a student completes this one.</p>
                      </div>
                      <Switch
                        checked={followUpEnabled}
                        onCheckedChange={() => setFollowUpEnabled(prev => !prev)}
                      />
                    </div>

                    {followUpEnabled && (
                      <div className="space-y-3 pl-2 border-l-2 border-border">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Follow-up Course</Label>
                          <Select
                            value={followUpCourseId}
                            onValueChange={(v) => {
                              setFollowUpCourseId(v)
                              // Reset version + cohort when the course changes.
                              setFollowUpVersionId("")
                              setFollowUpCohortId("")
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a course" />
                            </SelectTrigger>
                            <SelectContent>
                              {followUpCourseOptions.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Follow-up Version</Label>
                          <Select
                            value={followUpVersionId}
                            onValueChange={(v) => {
                              setFollowUpVersionId(v)
                              // Reset cohort when the target version changes.
                              setFollowUpCohortId("")
                            }}
                            disabled={!followUpCourseId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={followUpCourseId ? "Select a version" : "Select a course first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {followUpVersionIds.map((vid: string) => (
                                <SelectItem key={vid} value={vid}>
                                  <VersionLabel versionId={vid} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {followUpVersionLoading && followUpVersionId && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading course version…
                          </p>
                        )}

                        {/* Prompt the instructor for a cohort when the target version uses cohorts */}
                        {followUpRequiresCohort && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Cohort <span className="text-destructive">*</span>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              This course uses cohorts. Select which cohort students should join.
                            </p>
                            <Select
                              value={followUpCohortId}
                              onValueChange={(v) => setFollowUpCohortId(v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a cohort" />
                              </SelectTrigger>
                              <SelectContent>
                                {followUpCohorts.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Backfill: invite students who already completed this
                            course before the follow-up invite was configured. */}
                        {!isNew && (
                          <div className="space-y-1 pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              disabled={backfillLoading}
                              onClick={handleBackfill}
                            >
                              {backfillLoading ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" /> Sending invites…
                                </>
                              ) : (
                                "Invite past completers"
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Sends the saved follow-up invite to students who already finished this course and aren't enrolled yet. Save any changes first.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || followUpLoading}>
              {loading || followUpLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
