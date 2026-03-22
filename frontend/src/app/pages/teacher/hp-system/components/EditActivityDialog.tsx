import { useState, useEffect } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HpActivity } from "@/lib/api/hp-system";
import { Trash2, Plus } from "lucide-react";
import ConfirmationModal from "../../components/confirmation-modal";

interface EditActivityDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    activity: HpActivity | null;
    onSubmit: (id: string, data: Partial<HpActivity>) => Promise<void>;
}

type EditFormValues = {
    title: string;
    description: string;
    activityType: string;
    submissionMode: string;
    externalLink?: string;
    attachments: { name: string; url: string; kind: 'PDF' | 'LINK' | 'OTHER' }[];
};

export function EditActivityDialog({
    isOpen,
    onOpenChange,
    activity,
    onSubmit
}: EditActivityDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingData, setPendingData] = useState<EditFormValues | null>(null);

    const [savedModeBeforeVibe, setSavedModeBeforeVibe] = useState<string | null>(null);

    const { control, register, handleSubmit, reset, watch, setValue, getValues, formState: { errors } } = useForm<EditFormValues>({
        defaultValues: {
            title: "",
            description: "",
            activityType: "ASSIGNMENT",
            submissionMode: "IN_PLATFORM",
            externalLink: "",
            attachments: []
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "attachments"
    });

    useEffect(() => {
        if (isOpen && activity) {
            reset({
                title: activity.title || "",
                description: activity.description || "",
                activityType: activity.activityType || "ASSIGNMENT",
                submissionMode: activity.submissionMode || "IN_PLATFORM",
                externalLink: activity.externalLink || "",
                attachments: activity.attachments || []
            });
            setSavedModeBeforeVibe(null);
        }
    }, [isOpen, activity, reset]);

    const handleSaveClick = (data: EditFormValues) => {
        setPendingData(data);
        setIsConfirmOpen(true);
    };

    const handleConfirmSave = async () => {
        if (pendingData) {
            await handleFormSubmit(pendingData);
            setIsConfirmOpen(false);
        }
    };

    const handleFormSubmit = async (data: EditFormValues) => {
        if (!activity) return;
        setIsSubmitting(true);
        try {
            await onSubmit(activity._id, {
                ...data,
                activityType: data.activityType as any,
                submissionMode: data.submissionMode as any,
                externalLink: data.submissionMode === "EXTERNAL_LINK" ? data.externalLink : "",
                attachments: data.attachments?.map(att => ({ ...att, kind: att.kind || "LINK" })),
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update activity", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Activity</DialogTitle>
                    <DialogDescription>
                        Update the details and attachments for this activity.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleSaveClick)} className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title <span className="text-red-500">*</span></Label>
                            <Input
                                {...register("title", { required: "Title is required" })}
                                className={errors.title ? "border-red-500" : ""}
                            />
                            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                {...register("description")}
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Activity Type</Label>
                                <Controller
                                    name="activityType"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={(value) => {
                                            const currentMode = getValues("submissionMode");
                                            const currentType = getValues("activityType");
                                            field.onChange(value);
                                            if (value === "VIBE_MILESTONE") {
                                                if (currentMode !== "IN_PLATFORM") {
                                                    setSavedModeBeforeVibe(currentMode);
                                                }
                                                setValue("submissionMode", "IN_PLATFORM", { shouldDirty: true, shouldValidate: true });
                                            } else {
                                                if (currentType === "VIBE_MILESTONE" && savedModeBeforeVibe) {
                                                    setValue("submissionMode", savedModeBeforeVibe, { shouldDirty: true, shouldValidate: true });
                                                    setSavedModeBeforeVibe(null);
                                                }
                                            }
                                        }} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                                                <SelectItem value="VIBE_MILESTONE">Vibe Platform Milestone</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Submission Mode</Label>
                                <Controller
                                    name="submissionMode"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={watch("activityType") === "VIBE_MILESTONE"}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IN_PLATFORM">In-Platform Uploads</SelectItem>
                                                <SelectItem value="EXTERNAL_LINK">External Link</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {watch("activityType") === "VIBE_MILESTONE" && (
                                    <p className="text-[10px] text-muted-foreground mt-1">Vibe platform milestones use in-platform tracking by default.</p>
                                )}
                            </div>

                            {watch("submissionMode") === "EXTERNAL_LINK" && watch("activityType") !== "VIBE_MILESTONE" && (
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>External Reference URL <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="url"
                                        placeholder="https://docs.google.com/..."
                                        {...register("externalLink", {
                                            required: watch("submissionMode") === "EXTERNAL_LINK" ? "Link is required" : false
                                        })}
                                        className={errors.externalLink ? "border-red-500" : ""}
                                    />
                                    {errors.externalLink && <p className="text-xs text-red-500">{errors.externalLink.message}</p>}
                                    <p className="text-xs text-muted-foreground">The resource students should visit to complete this activity.</p>
                                </div>
                            )}

                            <div className="space-y-2 sm:col-span-2">
                                {/* Deadline moved to Rule Settings dialog */}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">Attachments</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ name: "", url: "", kind: "LINK" })}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add Link
                            </Button>
                        </div>

                        {fields.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No attachments added yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-start gap-2 items-center bg-muted/40 p-2 rounded-md border">
                                        <input type="hidden" value="LINK" {...register(`attachments.${index}.kind` as const)} />
                                        <div className="grid grid-cols-2 gap-2 flex-1">
                                            <Input
                                                placeholder="Link Name (e.g. Instructions)"
                                                {...register(`attachments.${index}.name` as const, { required: true })}
                                                className="h-8 text-sm"
                                            />
                                            <Input
                                                placeholder="URL (https://...)"
                                                {...register(`attachments.${index}.url` as const, { required: true })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => remove(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmSave}
                title="Save Changes"
                description="Are you sure you want to save the changes to this activity? The updates will be visible to students if the activity is published."
                confirmText="Save Changes"
                cancelText="Cancel"
                isLoading={isSubmitting}
            />
        </Dialog>
    );
}
