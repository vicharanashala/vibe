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
import { HpRuleConfig, HpActivity } from "@/lib/api/hp-system";
import { useHpRuleConfig, useCreateHpRuleConfig, useUpdateHpRuleConfig, useHpActivities, useUpdateHpActivity } from "@/hooks/hooks";
import ConfirmationModal from "../../components/confirmation-modal";

interface RuleSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    courseVersionId: string;
    activityId: string;
}

export function RuleSettingsDialog({
    isOpen,
    onOpenChange,
    courseId,
    courseVersionId,
    activityId,
}: RuleSettingsDialogProps) {
    const [config, setConfig] = useState<Partial<HpRuleConfig> | null>(null);

    useEffect(()=>{
        console.log("RuleSettingsDialog props changed:", { isOpen, courseId, courseVersionId, activityId });
    })

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Hooks
    const { data: existingConfig, isLoading: fetchLoading, refetch } = useHpRuleConfig(isOpen ? activityId : undefined);
    console.log("Existing config from hook:", existingConfig, "Loading:", fetchLoading);
    const { data: activities = [] } = useHpActivities(courseVersionId, "", "", "");
    const activity = activities.find((a: HpActivity) => a._id === activityId);
    const { mutateAsync: createRuleConfig, isPending: isCreating } = useCreateHpRuleConfig();
    const { mutateAsync: updateRuleConfig, isPending: isUpdating } = useUpdateHpRuleConfig();
    const { mutateAsync: updateActivity, isPending: isUpdatingActivity } = useUpdateHpActivity();

    const loading = fetchLoading || isCreating || isUpdating;

    // Default configuration
    const defaultReward: any = {
        enabled: true,
        type: "ABSOLUTE",
        value: 10,
        applyWhen: "ON_APPROVAL",
        lateBehavior: "NO_REWARD",
    };

    const defaultPenalty: any = {
        enabled: false,
        type: "PERCENTAGE",
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
                } as any);
            } else if (!fetchLoading) {
                // No existing config — set defaults for creation
                setConfig({
                    isMandatory: true,
                    allowLateSubmission: false,
                    reward: defaultReward,
                    penalty: defaultPenalty,
                    limits: defaultLimits,
                    deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    required_percentage: activity?.required_percentage,
                } as any);
            }
        }
    }, [isOpen, existingConfig, fetchLoading, activity]);

    const handleSave = async () => {
        if (!config) return;
        try {
            const rulePayload = { ...config };
            const required_percentage = (rulePayload as any).required_percentage;
            delete (rulePayload as any).required_percentage;

            if (existingConfig?._id) {
                console.log("Updating existing config with ID:", existingConfig._id);
                await updateRuleConfig(activityId, rulePayload);
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
        } catch (error) {
            console.error("Failed to save rule config", error);
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

                        {/* Mandatory Toggle */}
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <Label className="text-base">Mandatory Activity</Label>
                                <p className="text-sm text-muted-foreground">
                                    Students must complete this to pass the cohort.
                                </p>
                            </div>
                            <Switch
                                checked={config?.isMandatory || false}
                                onCheckedChange={(c) => setConfig(prev => ({ ...prev, isMandatory: c } as any))}
                            />
                        </div>

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
                                            onChange={(e) => setConfig(prev => ({ ...prev, required_percentage: e.target.value === "" ? undefined : parseInt(e.target.value) } as any))}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                    </div>
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
                                    <Label>Deadline Date & Time</Label>
                                    <Input
                                        type="datetime-local"
                                        value={config?.deadlineAt ? new Date(config.deadlineAt).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => setConfig(prev => ({ ...prev, deadlineAt: new Date(e.target.value).toISOString() } as any))}
                                    />
                                </div>

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
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20 ${!config?.reward?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>

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
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            reward: { ...(prev?.reward || defaultReward), value: parseInt(e.target.value) || 0 }
                                        } as any))}
                                    />
                                </div>



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
                                        disabled={!config?.allowLateSubmission}
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
                                    {!config?.allowLateSubmission && <p className="text-[10px] text-muted-foreground">Enable Late Submissions to configure late behavior.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Penalty Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Penalty Configuration (Late)</h4>
                                <Switch
                                    checked={config?.penalty?.enabled || false}
                                    onCheckedChange={(c) => setConfig(prev => ({
                                        ...prev,
                                        penalty: { ...(prev?.penalty || defaultPenalty), enabled: c }
                                    } as any))}
                                />
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20 ${!config?.penalty?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            penalty: { ...(prev?.penalty || defaultPenalty), value: parseInt(e.target.value) || 0 }
                                        } as any))}
                                    />
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
                        </div>

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
