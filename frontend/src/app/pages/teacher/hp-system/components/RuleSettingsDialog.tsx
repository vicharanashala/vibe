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
import { HpRuleConfig } from "@/lib/api/hp-system";
import { useHpRuleConfig, useCreateHpRuleConfig, useUpdateHpRuleConfig } from "@/hooks/hooks";

interface RuleSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    courseVersionId: string;
    cohort?: string;
    ruleConfigId?: string;
    activityId: string;
}

export function RuleSettingsDialog({
    isOpen,
    onOpenChange,
    courseVersionId,
    activityId,
}: RuleSettingsDialogProps) {
    const [config, setConfig] = useState<Partial<HpRuleConfig> | null>(null);

    // Hooks
    const { data: existingConfig, isLoading: fetchLoading, refetch } = useHpRuleConfig(isOpen ? activityId : undefined);
    const { mutateAsync: createRuleConfig, isPending: isCreating } = useCreateHpRuleConfig();
    const { mutateAsync: updateRuleConfig, isPending: isUpdating } = useUpdateHpRuleConfig();

    const loading = fetchLoading || isCreating || isUpdating;

    // Sync fetched config into local state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (existingConfig) {
                setConfig(existingConfig);
            } else if (!fetchLoading) {
                // No existing config — set defaults for creation
                setConfig({
                    isMandatory: true,
                    allowLateSubmission: false,
                    lateRewardPolicy: "NONE",
                });
            }
        }
    }, [isOpen, existingConfig, fetchLoading]);

    const handleSave = async () => {
        if (!config) return;
        try {
            if (existingConfig?._id) {
                await updateRuleConfig(existingConfig._id, config);
            } else {
                const createPayload: Partial<HpRuleConfig> = {
                    courseId: "c1", // TODO: pass from parent
                    courseVersionId,
                    activityId,
                    ...config,
                };
                await createRuleConfig(createPayload);
            }
            refetch();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save rule config", error);
        }
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

                {loading ? (
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
                                onCheckedChange={(c) => setConfig(prev => ({ ...prev, isMandatory: c }))}
                            />
                        </div>

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
                                        onChange={(e) => setConfig(prev => ({ ...prev, deadlineAt: new Date(e.target.value).toISOString() }))}
                                    />
                                </div>

                                <div className="space-y-2 flex flex-col justify-end pb-2">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="allow-late"
                                            checked={config?.allowLateSubmission || false}
                                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, allowLateSubmission: c }))}
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
                                <Switch checked={true} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">

                                <div className="space-y-2">
                                    <Label>Rule Type</Label>
                                    <Select defaultValue="ABSOLUTE">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ABSOLUTE">Absolute Points (+XP)</SelectItem>
                                            <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Reward Value</Label>
                                    <Input type="number" defaultValue={10} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Apply Policy</Label>
                                    <Select defaultValue="ON_APPROVAL">
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
                                        value={config?.lateRewardPolicy || "NO_REWARD"}
                                        onValueChange={(val: any) => setConfig(prev => ({ ...prev, lateRewardPolicy: val }))}
                                        disabled={!config?.allowLateSubmission}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NO_REWARD">Deny Reward</SelectItem>
                                            <SelectItem value="REWARD_ALLOWED">Allow Reward</SelectItem>
                                            <SelectItem value="REWARD_DENIED">Penalty Apply (No Reward)</SelectItem>
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
                                <Switch checked={false} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20 opacity-60 pointer-events-none">
                                <div className="space-y-2">
                                    <Label>Penalty Type</Label>
                                    <Select defaultValue="PERCENTAGE">
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
                                    <Input type="number" defaultValue={5} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Grace Period (Minutes)</Label>
                                    <Input type="number" defaultValue={0} />
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Configuration"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
