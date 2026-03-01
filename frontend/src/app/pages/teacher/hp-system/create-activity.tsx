import { useParams, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { ArrowLeft, Save, FileText, Settings as SettingsIcon, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { CreateHpActivityPayload } from "@/lib/api/hp-system";
import { useCreateHpActivity } from "@/hooks/hooks";

export default function CreateHpActivityPage() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();
    const { mutateAsync: createActivity, isPending: isSubmitting } = useCreateHpActivity();

    const { control, register, handleSubmit, watch, formState: { errors } } = useForm<CreateHpActivityPayload>({
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

    const currentSubmissionMode = watch("submissionMode");

    const onSubmit = async (data: CreateHpActivityPayload, status: "DRAFT" | "PUBLISHED") => {
        const payload = {
            ...data,
            courseId: "c1", // TODO: pass dynamically
            courseVersionId: courseVersionId || "",
            cohort: cohortName || "",
            status
        };

        try {
            await createActivity(payload);
            navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities` });
        } catch (error) {
            console.error("Failed to create activity", error);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex items-center gap-4 border-b pb-4">
                <Button variant="outline" size="icon" onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities` })}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Create New Activity</h2>
                    <p className="text-muted-foreground">Define a new HP rewarding activity for {decodeURIComponent(cohortName || '')}.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit((data) => onSubmit(data, "DRAFT"))} className="space-y-8">

                {/* Basic Info Section */}
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
                                                <SelectItem value="VIBE_AUTO">Automatic (Vibe Integration)</SelectItem>
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

                {/* Attachments Section */}
                <div className="space-y-6 bg-card border rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <LinkIcon className="h-5 w-5 text-primary" /> Attachments & Resources
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ name: "", url: "", kind: "LINK" })}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Link
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {fields.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                                No attachments added. Click "Add Link" to provide resources for students.
                            </div>
                        ) : (
                            fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_120px_auto] gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">Link Name</label>
                                        <Input
                                            placeholder="e.g. Project Specs"
                                            {...register(`attachments.${index}.name` as const, { required: "Name is required" })}
                                            className={errors.attachments?.[index]?.name ? "border-red-500" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">URL</label>
                                        <Input
                                            placeholder="https://..."
                                            {...register(`attachments.${index}.url` as const, { required: "URL is required" })}
                                            className={errors.attachments?.[index]?.url ? "border-red-500" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">Type</label>
                                        <Controller
                                            name={`attachments.${index}.kind` as const}
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LINK">Link</SelectItem>
                                                        <SelectItem value="PDF">PDF</SelectItem>
                                                        <SelectItem value="OTHER">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities` })}>
                        Cancel
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleSubmit(data => onSubmit(data, "DRAFT"))} disabled={isSubmitting}>
                        <Save className="mr-2 h-4 w-4" /> Save Draft
                    </Button>
                    <Button type="button" variant="default" onClick={handleSubmit(data => onSubmit(data, "PUBLISHED"))} disabled={isSubmitting}>
                        <Save className="mr-2 h-4 w-4" /> Save & Publish
                    </Button>
                </div>

            </form>
        </div>
    );
}
