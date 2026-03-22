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
import { toast } from "sonner";

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

    const { control, register, handleSubmit, reset, setError, formState: { errors } } = useForm<EditFormValues>({
        defaultValues: {
            title: "",
            description: "",
            activityType: "ASSIGNMENT",
            submissionMode: "IN_PLATFORM",
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
                attachments: activity.attachments || []
            });
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
                attachments: data.attachments?.map(att => ({ ...att, kind: att.kind || "LINK" })),
            });
            onOpenChange(false);
            toast.success("Activity updated successfully");
        } catch (error: any) {
            console.error("Failed to update activity", error);
            if (error.response) {
                try {
                    const detail = await error.response.json();
                    
                    if (detail.errors && Array.isArray(detail.errors)) {
                        let hasFieldErrors = false;
                        const validFormFields = ["title", "description", "activityType", "submissionMode", "externalLink", "attachments"];

                        detail.errors.forEach((err: any) => {
                            if (err.property && validFormFields.includes(err.property)) {
                                const message = err.constraints ? Object.values(err.constraints).join(", ") : "Validation failed";
                                setError(err.property as any, { type: "server", message });
                                hasFieldErrors = true;
                            }
                        });
                        
                        if (!hasFieldErrors && detail.message) {
                            toast.error(detail.message);
                        } else if (hasFieldErrors) {
                            toast.error("Please check the form for validation errors.");
                        }
                    } else if (detail.message) {
                        toast.error(detail.message);
                    } else {
                        toast.error("An unexpected error occurred during update.");
                    }
                } catch (e) {
                    console.error("Could not parse backend error JSON");
                    toast.error("Failed to update activity. Please try again.");
                }
            } else {
                toast.error(error.message || "Failed to update activity. Please try again.");
            }
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
                                className={`min-h-[100px] ${errors.description ? "border-red-500" : ""}`}
                            />
                            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Activity Type</Label>
                                <Controller
                                    name="activityType"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className={errors.activityType ? "border-red-500" : ""}>
                                                <SelectValue />
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
                                {errors.activityType && <p className="text-xs text-red-500">{errors.activityType.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Submission Mode</Label>
                                <Controller
                                    name="submissionMode"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className={errors.submissionMode ? "border-red-500" : ""}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IN_PLATFORM">In-Platform Uploads</SelectItem>
                                                <SelectItem value="EXTERNAL_LINK">External Link</SelectItem>
                                                <SelectItem value="VIBE_AUTO">Automatic (Vibe Integration)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.submissionMode && <p className="text-xs text-red-500">{errors.submissionMode.message}</p>}
                            </div>

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
                                            <div className="space-y-1">
                                                <Input
                                                    placeholder="Link Name (e.g. Instructions)"
                                                    {...register(`attachments.${index}.name` as const, { required: "Name is required" })}
                                                    className={`h-8 text-sm ${errors.attachments?.[index]?.name ? "border-red-500" : ""}`}
                                                />
                                                {errors.attachments?.[index]?.name && <p className="text-[10px] text-red-500">{errors.attachments[index]?.name?.message}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <Input
                                                    placeholder="URL (https://...)"
                                                    {...register(`attachments.${index}.url` as const, { required: "URL is required" })}
                                                    className={`h-8 text-sm ${errors.attachments?.[index]?.url ? "border-red-500" : ""}`}
                                                />
                                                {errors.attachments?.[index]?.url && <p className="text-[10px] text-red-500">{errors.attachments[index]?.url?.message}</p>}
                                            </div>
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
