import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HpRuleConfig, HpActivity, SubmissionField } from "@/lib/api/hp-system";
import { useHpRuleConfig, useCreateHpRuleConfig, useUpdateHpRuleConfig, useHpActivities, useUpdateHpActivity } from "@/hooks/hooks";
import ConfirmationModal from "../../components/confirmation-modal";
import { toast } from "sonner";

interface RuleSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    courseVersionId: string;
    cohortName: string;
    activityId: string;
}

export function RuleSettingsDialog({
    isOpen,
    onOpenChange,
    courseId,
    courseVersionId,
    cohortName,
    activityId,
}: RuleSettingsDialogProps) {
    const [config, setConfig] = useState<Partial<HpRuleConfig> | null>(null);

    useEffect(()=>{
        console.log("RuleSettingsDialog props changed:", { isOpen, courseId, courseVersionId, activityId });
    })

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Hooks
    const { data: existingConfig, isLoading: fetchLoading, refetch } = useHpRuleConfig(isOpen ? activityId : undefined);
    const { data: activities = [] } = useHpActivities(courseVersionId, cohortName, "", "");
    const activity = activities.find((a: HpActivity) => a._id === activityId);
    const { mutateAsync: createRuleConfig, isPending: isCreating } = useCreateHpRuleConfig();
    const { mutateAsync: updateRuleConfig, isPending: isUpdating } = useUpdateHpRuleConfig();
    const { mutateAsync: updateActivity, isPending: isUpdatingActivity } = useUpdateHpActivity();
    const [saveError, setSaveError] = useState<string | null>(null);

    const loading = fetchLoading || isCreating || isUpdating;

    // Default configuration
    const defaultReward: any = {
        enabled: false,
        type: "ABSOLUTE",
        value: 10,
        applyWhen: "ON_APPROVAL",
        lateBehavior: "NO_REWARD",
    };

    const defaultPenalty: any = {
        enabled: false,
        type: "ABSOLUTE",
        value: 5,
        applyWhen: "AFTER_DEADLINE",
        graceMinutes: 0,
        runOnce: true,
    };

    const defaultLimits: any = {};

    // Sync fetched config into local state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (existingConfig) {
                setConfig({
                    ...existingConfig,
                    required_percentage: activity?.required_percentage,
                    submissionValidation: existingConfig?.submissionValidation ?? [SubmissionField.TEXT],
                } as any);
            } else if (!fetchLoading) {
                // No existing config — set defaults for creation
                setConfig({
                    isMandatory: false,
                    allowLateSubmission: false,
                    reward: defaultReward,
                    penalty: defaultPenalty,
                    limits: defaultLimits,
                    deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    required_percentage: activity?.required_percentage,
                    submissionValidation: [SubmissionField.TEXT],
                } as any);
            }
        }
    }, [isOpen, existingConfig, fetchLoading, activity]);

    const [errors, setErrors] = useState<{ deadlineAt?: string; penaltyEnabled?: string; requiredPercentage?: string; maxHp?: string; rewardValue?: string; penaltyValue?: string;}>({});

    const handleSave = async () => {
        if (!config) return;

        let hasError = false;
        const nextErrors: any = {};

        if (config.isMandatory && !config.deadlineAt) {
            nextErrors.deadlineAt = "Deadline is required for mandatory activities";
            hasError = true;
        } else if (config.deadlineAt) {
            const deadline = new Date(config.deadlineAt);
            if (deadline < new Date()) {
                nextErrors.deadlineAt = "Deadline cannot be in the past";
                hasError = true;
            }
        }

        if (config.isMandatory && !config.penalty?.enabled) {
            nextErrors.penaltyEnabled = "Penalty cannot be disabled for mandatory activities.";
            hasError = true;
        }

        if (activity?.activityType === "VIBE_MILESTONE" && ((config as any).required_percentage === undefined || Number.isNaN((config as any).required_percentage))) {
            nextErrors.requiredPercentage = "Required percentage must be provided for a Vibe Milestone activity.";
            hasError = true;
        }

        if (config.reward?.enabled) {
            if (config.reward.value === undefined || Number.isNaN(config.reward.value)) {
                nextErrors.rewardValue = "Reward value is required";
                hasError = true;
            } else if (config.reward.value <= 0) {
                nextErrors.rewardValue = "Reward value must be greater than 0";
                hasError = true;
            }
        }

        if (config.penalty?.enabled) {
            if (config.penalty.value === undefined || Number.isNaN(config.penalty.value)) {
                nextErrors.penaltyValue = "Penalty value is required";
                hasError = true;
            } else if (config.penalty.value <= 0) {
                nextErrors.penaltyValue = "Penalty value must be greater than 0";
                hasError = true;
            }
        }
        
        const isPercentageMode = config.reward?.type === "PERCENTAGE" || config.penalty?.type === "PERCENTAGE";

        if (isPercentageMode) {
            if (
                    config.limits?.minHp !== undefined &&
                    config.limits?.maxHp !== undefined &&
                    config.limits.maxHp <= config.limits.minHp
                ) {
                    nextErrors.maxHp = "Maximum HP must be greater than Minimum HP.";
                    hasError = true;
                }
        }
        setSaveError(null);
        if (hasError) {
            setErrors(nextErrors);
            return;
        }

        setErrors({});

        try {
            const rulePayload = { ...config };
            const required_percentage = (rulePayload as any).required_percentage;
            delete (rulePayload as any).required_percentage;

            if (existingConfig?._id) {
                console.log("Updating existing config with ID:", existingConfig._id);
                await updateRuleConfig(existingConfig._id, rulePayload);
            } else {
                const createPayload: Partial<HpRuleConfig> = {
                    courseId,
                    courseVersionId,
                    activityId,
                    ...rulePayload,
                };
                await createRuleConfig(createPayload);
            }

            if (activity && activity.required_percentage !== required_percentage) {
                await (updateActivity as any)(activityId, { required_percentage });
            }

            refetch();
            onOpenChange(false);
            toast.success("Rule configuration saved successfully");
        } catch (error: any) {
            console.error("Failed to save rule config", error);
            if (error.response) {
                try {
                    const detail = await error.response.json();
                    setSaveError(detail.message || "Failed to save configuration due to validation errors.");
                } catch (e) {
                    setSaveError("Failed to save configuration.");
                }
            } else {
                setSaveError(error.message || "Failed to save configuration.");
            }
        }
    };

    const handleConfirmSave = async () => {
        await handleSave();
        setIsConfirmOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Activity Rules & Settings</DialogTitle>
                    <DialogDescription>
                        Configure rewards, penalties, and completion limits for this activity.
                    </DialogDescription>
                </DialogHeader>

                {fetchLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
                ) : (
                    <div className="space-y-8 py-4">

                        {/* Mandatory Toggle — hidden for VIBE_MILESTONE (always mandatory) */}
                        {activity?.activityType !== "VIBE_MILESTONE" && (
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <Label className="text-base">Mandatory Activity</Label>
                                <p className="text-sm text-muted-foreground">
                                    Students must complete this to pass the cohort.
                                </p>
                            </div>
                            <Switch
                                checked={config?.isMandatory || false}
                                onCheckedChange={(c) => setConfig(prev => ({ 
                                    ...prev, 
                                    isMandatory: c,
                                    penalty: !c ? { ...prev?.penalty, enabled: false } : prev?.penalty
                                } as any))}
                            />
                        </div>
                        )}

                        {/* Required Progress Percentage (Milestones Only) */}
                        {(activity?.activityType === "MILESTONE" || activity?.activityType === "VIBE_MILESTONE") && (
                            <div className="flex flex-col md:flex-row md:items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                                <div className="space-y-1">
                                    <Label className="text-base text-foreground">Required Progress Percentage</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Minimum progress percentage required.
                                    </p>
                                </div>
                                <div className="w-full md:w-32">
                                    <div className="relative mt-2 md:mt-0">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            placeholder="100"
                                            className="pr-8"
                                            value={(config as any)?.required_percentage ?? ""}
                                            onChange={(e) => {
                                                setConfig(prev => ({ ...prev, required_percentage: e.target.value === "" ? undefined : parseInt(e.target.value) } as any));
                                                if (errors.requiredPercentage) {
                                                    setErrors(prev => ({ ...prev, requiredPercentage: undefined }));
                                                }
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                    </div>
                                    {errors.requiredPercentage && <p className="text-xs text-red-500 mt-1">{errors.requiredPercentage}</p>}
                                </div>
                            </div>
                        )}

                        {/* Deadline Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deadline Configuration</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">

                                <div className="space-y-2">
                                    <Label>
                                        Deadline Date & Time
                                        {!config?.isMandatory && (
                                            <span className="text-muted-foreground text-xs ml-1">(Optional)</span>
                                        )}
                                    </Label>
                                    <Input
                                        type="datetime-local"
                                        min={
                                            new Date()
                                                .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
                                                .slice(0, 16)
                                                .replace(" ", "T")
                                            }
                                        value={
                                            config?.deadlineAt
                                                ? new Date(config.deadlineAt)
                                                    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
                                                    .slice(0, 16)
                                                    .replace(" ", "T")
                                                : ""
                                            }
                                        onChange={(e) => {
                                            const val = e.target.value;

                                            setConfig(prev => ({
                                                ...prev,
                                                deadlineAt: val
                                                ? new Date(`${val}:00+05:30`).toISOString()
                                                : undefined
                                            }));
                                            if (errors.deadlineAt) setErrors({});
                                        }}
                                    />
                                    {errors.deadlineAt && <p className="text-xs text-red-500 mt-1">{errors.deadlineAt}</p>}
                                </div>

                                {/* Allow Late — hidden for VIBE_MILESTONE */}
                                {activity?.activityType !== "VIBE_MILESTONE" && (
                                <div className="space-y-2 flex flex-col justify-end pb-2">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="allow-late"
                                            checked={config?.allowLateSubmission || false}
                                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, allowLateSubmission: c } as any))}
                                        />
                                        <Label htmlFor="allow-late">Allow Late Submissions</Label>
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>

                        {/* Reward Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reward Configuration</h4>
                                <Switch
                                    checked={config?.reward?.enabled || false}
                                    onCheckedChange={(c) => setConfig(prev => ({
                                        ...prev,
                                        reward: { ...(prev?.reward || defaultReward), enabled: c }
                                    } as any))}
                                />
                            </div>
                            {config?.reward?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">

                                <div className="space-y-2">
                                    <Label>Rule Type</Label>
                                    <Select
                                        value={config?.reward?.type || "ABSOLUTE"}
                                        onValueChange={(v: any) => setConfig(prev => ({
                                            ...prev,
                                            reward: { ...(prev?.reward || defaultReward), type: v }
                                        } as any))}
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
                                        value={config?.reward?.value || 0}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setConfig(prev => ({
                                            ...prev,
                                            reward: {
                                                ...(prev?.reward || defaultReward),
                                                value: value === "" ? undefined : parseInt(value)
                                            }
                                            } as any));

                                            if (errors.rewardValue) {
                                            setErrors(prev => ({ ...prev, rewardValue: undefined }));
                                            }
                                        }}
                                    />
                                    {errors.rewardValue && (
                                        <p className="text-xs text-red-500">{errors.rewardValue}</p>
                                    )}
                                </div>



                                {/* Apply Policy — hidden for VIBE_MILESTONE */}
                                {activity?.activityType !== "VIBE_MILESTONE" && (
                                <div className="space-y-2">
                                    <Label>Apply Policy</Label>
                                    <Select
                                        value={config?.reward?.applyWhen || "ON_APPROVAL"}
                                        onValueChange={(v: any) => setConfig(prev => ({
                                            ...prev,
                                            reward: { ...(prev?.reward || defaultReward), applyWhen: v }
                                        } as any))}
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
                                )}

                                {/* Late Reward Behavior — only shown when allow late is ON */}
                                {config?.allowLateSubmission && (
                                <div className="space-y-2">
                                    <Label>Late Reward Behavior</Label>
                                    <Select
                                        value={
                                            config?.reward?.lateBehavior === "REWARD"
                                                ? "REWARD_ALLOWED"
                                                : config?.reward?.lateBehavior === "NO_REWARD"
                                                    ? "REWARD_DENIED"
                                                    : "NONE"
                                        }
                                        disabled={config?.penalty?.enabled}
                                        onValueChange={(val: any) => {
                                            if (val === "REWARD_ALLOWED") {
                                                setConfig(prev => ({
                                                    ...prev,
                                                    reward: {
                                                        ...(prev?.reward || defaultReward),
                                                        lateBehavior: "REWARD"
                                                    }
                                                } as any));
                                            } else {
                                                setConfig(prev => ({
                                                    ...prev,
                                                    reward: {
                                                        ...(prev?.reward || defaultReward),
                                                        lateBehavior: "NO_REWARD"
                                                    }
                                                } as any));
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            <SelectItem value="REWARD_ALLOWED">Allow Reward</SelectItem>
                                            <SelectItem value="REWARD_DENIED">Deny Reward</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                )}
                            </div>
                            )}
                        </div>
                        {/* Penalty Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Penalty Configuration (Late)</h4>
                                <Switch
                                    checked={config?.penalty?.enabled || false}
                                    onCheckedChange={(c) => setConfig(prev => ({
                                        ...prev,
                                        penalty: { ...(prev?.penalty || {}), enabled: c },
                                        reward: c
                                            ? {
                                                ...(prev?.reward || defaultReward),
                                                lateBehavior: "NO_REWARD"
                                            }
                                            : prev?.reward
                                    } as any))}
                                />
                            </div>
                            {errors.penaltyEnabled && <p className="text-xs text-red-500 mt-1">{errors.penaltyEnabled}</p>}
                            {config?.penalty?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                <div className="space-y-2">
                                    <Label>Penalty Type</Label>
                                    <Select
                                        value={config?.penalty?.type || "PERCENTAGE"}
                                        onValueChange={(v: any) => setConfig(prev => ({
                                            ...prev,
                                            penalty: { ...(prev?.penalty || defaultPenalty), type: v }
                                        } as any))}
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
                                        value={config?.penalty?.value || 0}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setConfig(prev => ({
                                            ...prev,
                                            penalty: {
                                                ...(prev?.penalty || defaultPenalty),
                                                value: value === "" ? undefined : parseInt(value)
                                            }
                                            } as any));

                                            if (errors.penaltyValue) {
                                            setErrors(prev => ({ ...prev, penaltyValue: undefined }));
                                            }
                                        }}
                                    />
                                    {errors.penaltyValue && (
                                        <p className="text-xs text-red-500">{errors.penaltyValue}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Grace Period (Minutes)</Label>
                                    <Input
                                        type="number"
                                        value={config?.penalty?.graceMinutes || 0}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            penalty: { ...(prev?.penalty || defaultPenalty), graceMinutes: parseInt(e.target.value) || 0 }
                                        } as any))}
                                    />
                                </div>
                            </div>
                            )}
                        </div>
                        {/* HP Limits */}
                        {(config?.reward?.type === "PERCENTAGE" || config?.penalty?.type === "PERCENTAGE") && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">HP Limits (Cap)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                    <div className="space-y-2">
                                        <Label>Minimum HP (Cap) <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={config?.limits?.minHp ?? ""}
                                            onChange={(e) => setConfig(prev => ({
                                                ...prev,
                                                limits: { ...(prev?.limits || {}), minHp: e.target.value === "" ? undefined : parseInt(e.target.value) }
                                            } as any))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Maximum HP (Cap) <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={config?.limits?.maxHp ?? ""}
                                            onChange={(e) => setConfig(prev => ({
                                                ...prev,
                                                limits: { ...(prev?.limits || {}), maxHp: e.target.value === "" ? undefined : parseInt(e.target.value) }
                                            } as any))}
                                        />
                                        {errors.maxHp && <p className="text-xs text-red-500 mt-1">{errors.maxHp}</p>}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    💡 Recommended for more consistent HP allocation. Define lower and upper bounds for HP changes when using percentage-based calculations.
                                </p>
                            </div>
                        )}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Submission Requirements
                            </h4>

                            <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                
                                {[
                                { label: "Text Response", value: SubmissionField.TEXT },
                                { label: "PDF Upload", value: SubmissionField.PDF },
                                { label: "Images", value: SubmissionField.IMAGE },
                                { label: "URL Links", value: SubmissionField.URL },
                                ].map((item) => {
                                const selected = config?.submissionValidation || [];

                                return (
                                    <div key={item.value} className="flex items-center justify-between">
                                    <Label>{item.label}</Label>
                                    <Switch
                                        checked={selected.includes(item.value)}
                                        onCheckedChange={(checked) => {
                                        let updated = [...selected];

                                        if (checked) {
                                            updated.push(item.value);
                                        } else {
                                            updated = updated.filter(v => v !== item.value);
                                        }

                                        // ❗ Prevent removing all
                                        if (updated.length === 0) {
                                            toast.error("At least one submission field must be required");
                                            return;
                                        }

                                        setConfig(prev => ({
                                            ...prev,
                                            submissionValidation: updated
                                        }));
                                        }}
                                    />
                                    </div>
                                );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {saveError && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-md flex items-start gap-2">
                        <span>{saveError}</span>
                    </div>
                )}
                <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                                
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => setIsConfirmOpen(true)} disabled={loading}>{loading ? "Saving..." : "Save Configuration"}</Button>
                </DialogFooter>
            </DialogContent>
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmSave}
                title="Save Configuration"
                description="Are you sure you want to save these rules and settings for the activity? These rules will apply to all future submissions."
                confirmText="Save Configuration"
                cancelText="Cancel"
                isLoading={loading}
            />
        </Dialog>
    );
}
