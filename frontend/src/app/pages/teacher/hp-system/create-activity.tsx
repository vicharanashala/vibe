import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    ArrowLeft, ArrowRight, Save, FileText, Settings, Plus, Trash2,
    Link as LinkIcon, CheckCircle
} from "lucide-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { CreateHpActivityPayload, HpRuleConfig, CourseWithVersions, CourseVersionStats } from "@/lib/api/hp-system";
import { useCreateHpActivity, useCreateHpRuleConfig, useHpCourseVersions } from "@/hooks/hooks";

export default function CreateHpActivityPage() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();
    const { mutateAsync: createActivity, isPending: isSubmittingActivity } = useCreateHpActivity();
    const { mutateAsync: createRuleConfig, isPending: isSubmittingRules } = useCreateHpRuleConfig();
    const { data: courses = [], isLoading: isLoadingCourses } = useHpCourseVersions();

    const isSubmitting = isSubmittingActivity || isSubmittingRules;

    const [step, setStep] = useState<1 | 2>(1);

    // Find the correct courseId for the given courseVersionId
    const course = courses.find((c: CourseWithVersions) =>
        c.versions.some((v: CourseVersionStats) => v.courseVersionId === courseVersionId)
    );
    const courseId = course?.courseId;

    // ── Step 1: Activity form ──
    const { control, register, handleSubmit, watch, trigger, formState: { errors } } = useForm<CreateHpActivityPayload>({
        defaultValues: {
            title: "",
            description: "",
            activityType: "ASSIGNMENT",
            submissionMode: "IN_PLATFORM",
            externalLink: "",
            attachments: []
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "attachments" });
    const currentSubmissionMode = watch("submissionMode");

    // ── Step 2: Rule config (local state, matches RuleSettingsDialog) ──
    const [ruleConfig, setRuleConfig] = useState<Partial<HpRuleConfig>>({
        isMandatory: true,
        allowLateSubmission: false,
        lateRewardPolicy: "NONE",
        reward: {
            enabled: true,
            type: "ABSOLUTE",
            value: 10,
            applyWhen: "ON_APPROVAL",
            onlyWithinDeadline: true,
            allowLate: false,
            lateBehavior: "NO_REWARD",
            minHpFloor: 0,
            required_percentage: undefined,
        },
        penalty: {
            enabled: false,
            type: "ABSOLUTE",
            value: 5,
            applyWhen: "AFTER_DEADLINE",
            graceMinutes: 0,
            runOnce: true,
        },
        limits: {
            minHp: 0,
            maxHp: 1000,
        }
    });

    const goToStep2 = async () => {
        const valid = await trigger();
        if (valid) setStep(2);
    };

    const isHex24 = (id?: string) => /^[0-9a-fA-F]{24}$/.test(id || "");

    const onSubmit = async (data: CreateHpActivityPayload, status: "DRAFT" | "PUBLISHED") => {
        if (!courseId || !courseVersionId) {
            console.error("Missing IDs:", { courseId, courseVersionId });
            return;
        }

        if (!isHex24(courseId) || !isHex24(courseVersionId)) {
            console.error("Invalid ObjectId format discovered:", { courseId, courseVersionId });
        }

        // 1. Prepare activity payload (including some fields from ruleConfig that Activity needs)
        const activityPayload = {
            ...data,
            courseId: courseId,
            courseVersionId: courseVersionId,
            cohort: cohortName || "",
            attachments: data.attachments?.map(att => ({ ...att, kind: att.kind || "LINK" })),
            status,
            deadlineAt: ruleConfig.deadlineAt || new Date().toISOString(),
            allowLateSubmission: ruleConfig.allowLateSubmission || false,
            lateRewardPolicy: ruleConfig.lateRewardPolicy || "NONE",
        };

        try {
            // 2. Create the activity
            const response: any = await createActivity(activityPayload);
            // The backend might return _id as a string, or an object if it serialized an ObjectId directly
            let createdActivityId = response?._id;
            if (createdActivityId && typeof createdActivityId === "object") {
                createdActivityId = createdActivityId.$oid || createdActivityId.id || createdActivityId.toString();
                // If it's a buffer object, this might be tricky, but mostly $oid or id works
            }

            if (!createdActivityId || typeof createdActivityId !== "string") {
                console.error("Activity creation returned no valid string ID", response);
                throw new Error("Missing valid activity ID from response");
            }

            // 3. Create the full Rule Config
            const rulePayload = {
                courseId: courseId,
                courseVersionId: courseVersionId,
                activityId: createdActivityId,
                ...ruleConfig,
                deadlineAt: ruleConfig.deadlineAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 1 week from now
            };

            try {
                await createRuleConfig(rulePayload);
            } catch (ruleError: any) {
                console.error("Rule config creation failed:", ruleError);
                // Don't block navigation – activity was created, rule config just failed
            }

            // 4. Navigate back
            navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities` });
        } catch (error: any) {
            console.error("Failed to create activity", error);
            if (error.response) {
                try {
                    const detail = await error.response.json();
                    console.error("Backend Error Detail JSON:", detail);
                } catch (e) {
                    console.error("Could not parse backend error JSON");
                }
            }
        }
    };

    const backUrl = `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities`;

    if (isLoadingCourses) {
        return <div className="p-8 text-center text-muted-foreground">Loading course info...</div>;
    }

    if (!courseId) {
        return (
            <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg text-red-600">
                <h3 className="text-lg font-bold">Configuration Error</h3>
                <p>Could not find the parent course for version ID: {courseVersionId}</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate({ to: '/teacher/hp-system' })}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6  mx-4 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4">
                <Button variant="outline" size="icon" onClick={() => step === 1 ? navigate({ to: backUrl }) : setStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Create New Activity</h2>
                    <p className="text-muted-foreground">Define a new HP rewarding activity for {decodeURIComponent(cohortName || '')}.</p>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-0">
                <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-green-600 text-white'}`}>
                        {step === 2 ? <CheckCircle className="h-4 w-4" /> : '1'}
                    </div>
                    <span className={`text-sm font-medium ${step === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>Activity Details</span>
                </div>
                <div className="flex-1 h-px bg-border mx-4" />
                <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        2
                    </div>
                    <span className={`text-sm font-medium ${step === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>Rules & Settings</span>
                </div>
            </div>

            {/* ─────────────── STEP 1: Activity Details ─────────────── */}
            {step === 1 && (
                <form onSubmit={(e) => { e.preventDefault(); goToStep2(); }} className="space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-6 bg-card border rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                            <FileText className="h-5 w-5 text-primary" /> Basic Information
                        </div>
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Activity Title <span className="text-red-500">*</span></label>
                                <Input
                                    placeholder="e.g. Midterm Essay Submission"
                                    {...register("title", { required: "Title is required" })}
                                    className={errors.title ? "border-red-500" : ""}
                                />
                                {errors.title && <p className="text-xs text-red-500">{errors.title.message as string}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <Textarea
                                    placeholder="Describe the expectations for this activity..."
                                    className="min-h-[120px]"
                                    {...register("description")}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Activity Type</label>
                                    <Controller
                                        name="activityType"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                                                    <SelectItem value="MILESTONE">Milestone</SelectItem>
                                                    <SelectItem value="EXTERNAL_IMPORT">External Import</SelectItem>
                                                    <SelectItem value="VIBE_MILESTONE">Vibe Platform Milestone</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Submission Mode</label>
                                    <Controller
                                        name="submissionMode"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="IN_PLATFORM">In-Platform Uploads</SelectItem>
                                                    <SelectItem value="EXTERNAL_LINK">External Link</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            {currentSubmissionMode === "EXTERNAL_LINK" && (
                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-medium">External Reference URL <span className="text-red-500">*</span></label>
                                    <Input
                                        type="url"
                                        placeholder="https://docs.google.com/..."
                                        {...register("externalLink", {
                                            required: currentSubmissionMode === "EXTERNAL_LINK" ? "Link is required" : false
                                        })}
                                        className={errors.externalLink ? "border-red-500" : ""}
                                    />
                                    {errors.externalLink && <p className="text-xs text-red-500">{errors.externalLink.message as string}</p>}
                                    <p className="text-xs text-muted-foreground">The resource students should visit to complete this activity.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="space-y-6 bg-card border rounded-lg p-6 shadow-sm">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <LinkIcon className="h-5 w-5 text-primary" /> Attachments & Resources
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", url: "", kind: "LINK" })}>
                                <Plus className="h-4 w-4 mr-2" /> Add Link
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No links added. Click <span className="font-medium">"Add Link"</span> to provide optional resources for students.
                                </p>
                            )}
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
                                    <input type="hidden" value="LINK" {...register(`attachments.${index}.kind` as const)} />
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">
                                            Link Name <span className="text-muted-foreground normal-case font-normal">(optional)</span>
                                        </label>
                                        <Input
                                            placeholder="e.g. Project Specs"
                                            {...register(`attachments.${index}.name` as const, { required: "Name is required" })}
                                            className={errors.attachments?.[index]?.name ? "border-red-500" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">
                                            URL <span className="text-muted-foreground normal-case font-normal">(optional)</span>
                                        </label>
                                        <Input
                                            placeholder="https://... (optional)"
                                            {...register(`attachments.${index}.url` as const, { required: "URL is required" })}
                                            className={errors.attachments?.[index]?.url ? "border-red-500" : ""}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate({ to: backUrl })}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </form>
            )}

            {/* ─────────────── STEP 2: Rules & Settings ─────────────── */}
            {step === 2 && (
                <div className="space-y-8">
                    <div className="space-y-6 bg-card border rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                            <Settings className="h-5 w-5 text-primary" /> Rules & Settings
                        </div>

                        <div className="space-y-8">
                            {/* Mandatory Toggle */}
                            <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Mandatory Activity</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Students must complete this to pass the cohort.
                                    </p>
                                </div>
                                <Switch
                                    checked={ruleConfig.isMandatory || false}
                                    onCheckedChange={(c) => setRuleConfig(prev => ({ ...prev, isMandatory: c }))}
                                />
                            </div>

                            {/* Deadline Settings */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deadline Configuration</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                    <div className="space-y-2">
                                        <Label>Deadline Date & Time</Label>
                                        <Input
                                            type="datetime-local"
                                            value={ruleConfig.deadlineAt ? new Date(ruleConfig.deadlineAt).toISOString().slice(0, 16) : ""}
                                            onChange={(e) => setRuleConfig(prev => ({ ...prev, deadlineAt: new Date(e.target.value).toISOString() }))}
                                        />
                                    </div>
                                    <div className="space-y-2 flex flex-col justify-end pb-2">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id="allow-late"
                                                checked={ruleConfig.allowLateSubmission || false}
                                                onCheckedChange={(c) => setRuleConfig(prev => ({ ...prev, allowLateSubmission: c }))}
                                            />
                                            <Label htmlFor="allow-late">Allow Late Submissions</Label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reward Settings */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reward Configuration</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                    <div className="space-y-2">
                                        <Label>Rule Type</Label>
                                        <Select
                                            value={ruleConfig.reward?.type || "ABSOLUTE"}
                                            onValueChange={(v: any) => setRuleConfig(prev => ({
                                                ...prev,
                                                reward: { ...(prev.reward || {}), type: v } as any
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ABSOLUTE">Absolute Points</SelectItem>
                                                <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reward Value</Label>
                                        <Input
                                            type="number"
                                            value={ruleConfig.reward?.value || 0}
                                            onChange={(e) => setRuleConfig(prev => ({
                                                ...prev,
                                                reward: { ...(prev.reward || {}), value: parseInt(e.target.value) || 0 } as any
                                            }))}
                                        />
                                    </div>
                                    {(watch("activityType") === "MILESTONE" || watch("activityType") === "VIBE_MILESTONE") && (
                                        <div className="space-y-2">
                                            <Label>Required Progress Percentage</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder="e.g., 75"
                                                value={ruleConfig.reward?.required_percentage || ""}
                                                onChange={(e) => setRuleConfig(prev => ({
                                                    ...prev,
                                                    reward: { ...(prev.reward || {}), required_percentage: parseInt(e.target.value) || undefined } as any
                                                }))}
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Minimum progress percentage required to earn this milestone reward
                                            </p>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Apply Policy</Label>
                                        <Select
                                            value={ruleConfig.reward?.applyWhen || "ON_APPROVAL"}
                                            onValueChange={(v: any) => setRuleConfig(prev => ({
                                                ...prev,
                                                reward: { ...(prev.reward || {}), applyWhen: v } as any
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ON_SUBMISSION">Auto upon Submission</SelectItem>
                                                <SelectItem value="ON_APPROVAL">Manual (Instructor Approval)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Late Behavior</Label>
                                        <Select
                                            value={ruleConfig.lateRewardPolicy || "NONE"}
                                            onValueChange={(val: any) => setRuleConfig(prev => ({ ...prev, lateRewardPolicy: val }))}
                                            disabled={!ruleConfig.allowLateSubmission}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">Deny Reward</SelectItem>
                                                <SelectItem value="REWARD_ALLOWED">Allow Reward</SelectItem>
                                                <SelectItem value="REWARD_DENIED">Penalty Apply (No Reward)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!ruleConfig.allowLateSubmission && <p className="text-[10px] text-muted-foreground">Enable Late Submissions to configure late behavior.</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Penalty Settings */}
                            <div className="space-y-4">

                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                        Penalty Configuration (Late)
                                    </h4>

                                    <Switch
                                        checked={ruleConfig.penalty?.enabled || false}
                                        onCheckedChange={(c) =>
                                            setRuleConfig(prev => ({
                                                ...prev,
                                                penalty: {
                                                    ...(prev.penalty || {
                                                        enabled: false,
                                                        type: "ABSOLUTE",
                                                        value: 5,
                                                        applyWhen: "AFTER_DEADLINE",
                                                        graceMinutes: 0,
                                                        runOnce: true
                                                    }),
                                                    enabled: c
                                                }
                                            }))
                                        }
                                    />
                                </div>

                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20 ${
                                    !ruleConfig.penalty?.enabled ? "opacity-60 pointer-events-none" : ""
                                }`}>

                                    <div className="space-y-2">
                                        <Label>Penalty Type</Label>
                                        <Select
                                            value={ruleConfig.penalty?.type || "PERCENTAGE"}
                                            onValueChange={(v: any) => setRuleConfig(prev => ({
                                                ...prev,
                                                penalty: { ...(prev.penalty || {}), type: v } as any
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ABSOLUTE">Absolute Points</SelectItem>
                                                <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Penalty Value</Label>
                                        <Input
                                            type="number"
                                            value={ruleConfig.penalty?.value || 0}
                                            onChange={(e) => setRuleConfig(prev => ({
                                                ...prev,
                                                penalty: { ...(prev.penalty || {}), value: parseInt(e.target.value) || 0 } as any
                                            }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Grace Period (Minutes)</Label>
                                        <Input
                                            type="number"
                                            value={ruleConfig.penalty?.graceMinutes || 0}
                                            onChange={(e) => setRuleConfig(prev => ({
                                                ...prev,
                                                penalty: { ...(prev.penalty || {}), graceMinutes: parseInt(e.target.value) || 0 } as any
                                            }))}
                                        />
                                    </div>

                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Step 2 Actions */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => setStep(1)}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleSubmit(data => onSubmit(data, "DRAFT"))} disabled={isSubmitting}>
                            <Save className="mr-2 h-4 w-4" /> Save Draft
                        </Button>
                        <Button type="button" variant="default" onClick={handleSubmit(data => onSubmit(data, "PUBLISHED"))} disabled={isSubmitting}>
                            <Save className="mr-2 h-4 w-4" /> Save & Publish
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
