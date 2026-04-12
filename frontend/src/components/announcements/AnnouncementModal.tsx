import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Paperclip, X } from "lucide-react";
import { useCreateAnnouncement, useUpdateAnnouncement } from "@/hooks/announcement-hooks";
import { Announcement, AnnouncementType, Attachment } from "@/types/announcement.types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Announcement | null;
    defaultType?: AnnouncementType;
    courseId?: string;
    versionId?: string;
    isAdmin?: boolean;
    cohortId?: string;
}

export function AnnouncementModal({
    isOpen,
    onClose,
    initialData,
    defaultType = AnnouncementType.GENERAL,
    courseId,
    versionId,
    isAdmin,
    cohortId,
}: AnnouncementModalProps) {
    const isEditing = !!initialData;
    const createMutation = useCreateAnnouncement();
    const updateMutation = useUpdateAnnouncement();

    // Non-admins cannot create GENERAL announcements
    const effectiveDefaultType = (!isAdmin && defaultType === AnnouncementType.GENERAL)
        ? AnnouncementType.COURSE_SPECIFIC
        : defaultType;

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState<AnnouncementType>(effectiveDefaultType);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
    const [newAttachmentName, setNewAttachmentName] = useState("");

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setContent(initialData.content);
            setType(initialData.type);
            setAttachments(initialData.attachments || []);
        } else {
            setTitle("");
            setContent("");
            setType(effectiveDefaultType);
            setAttachments([]);
        }
    }, [initialData, effectiveDefaultType, isOpen]);

    const handleAddAttachment = () => {
        if (!newAttachmentUrl.trim()) return;

        // Validate URL — must start with http:// or https:// (matches backend @IsUrl rule)
        try {
            const url = new URL(newAttachmentUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
                toast.error("URL must start with http:// or https://");
                return;
            }
        } catch {
            toast.error("Please enter a valid URL (e.g. https://example.com/file.pdf)");
            return;
        }

        // Auto-detect fileType from URL extension
        let fileType = 'link';
        const lowerUrl = newAttachmentUrl.toLowerCase();
        if (lowerUrl.endsWith('.pdf')) fileType = 'pdf';
        else if (lowerUrl.match(/\.(jpeg|jpg|gif|png)$/)) fileType = 'image';

        setAttachments([
            ...attachments,
            {
                fileName: newAttachmentName || newAttachmentUrl,
                fileUrl: newAttachmentUrl,
                fileType,
            },
        ]);
        setNewAttachmentUrl("");
        setNewAttachmentName("");
    };

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // --- Frontend Validation ---
        if (!title.trim()) {
            toast.error("Title cannot be empty or just spaces");
            return;
        }
        if (!content.trim()) {
            toast.error("Content cannot be empty or just spaces");
            return;
        }
        // if (
        //     (type === AnnouncementType.COURSE_SPECIFIC || type === AnnouncementType.VERSION_SPECIFIC) &&
        //     !courseId
        // ) {
        //     toast.error("Course must be selected for course-specific or version-specific announcements");
        //     return;
        // }
        // if (type === AnnouncementType.VERSION_SPECIFIC && !versionId) {
        //     toast.error("Version must be selected for version-specific announcements");
        //     return;
        // }

        const body: any = {
            title,
            content,
            type,
            attachments,
            courseId: type === AnnouncementType.GENERAL ? undefined : courseId,
            courseVersionId: type === AnnouncementType.VERSION_SPECIFIC ? versionId : undefined,
            cohortId: type === AnnouncementType.COHORT_SPECIFIC ? cohortId : undefined,
        };

        try {
            if (isEditing && initialData) {
                await updateMutation.mutateAsync(initialData._id, body);
            } else {
                await createMutation.mutateAsync(body);
            }
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Announcement Scope</Label>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50">
                            <Badge variant="secondary" className="text-xs">
                                {type === AnnouncementType.GENERAL && "General — visible to all users"}
                                {type === AnnouncementType.COURSE_SPECIFIC && "Course Specific — visible to enrolled students"}
                                {type === AnnouncementType.VERSION_SPECIFIC && "Version Specific — visible to this version's students"}
                                {type === AnnouncementType.COHORT_SPECIFIC && "Cohort Specific — visible to this cohort's students"}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Announcement Title"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                            required
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Detailed content (HTML/Markdown supported in future)"
                            className="min-h-[150px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Attachments</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newAttachmentName}
                                onChange={(e) => setNewAttachmentName(e.target.value)}
                                placeholder="Name (Optional)"
                                className="flex-1"
                            />
                            <Input
                                value={newAttachmentUrl}
                                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                                placeholder="URL (https://...)"
                                className="flex-[2]"
                            />
                            <Button type="button" variant="secondary" onClick={handleAddAttachment}>
                                Add
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            {attachments.map((att, idx) => (
                                <Badge key={idx} variant="outline" className="flex items-center gap-1 pl-2 pr-1 py-1">
                                    <Paperclip className="h-3 w-3" />
                                    <a href={att.fileUrl} target="_blank" rel="noreferrer" className="hover:underline max-w-[150px] truncate">
                                        {att.fileName}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        className="ml-1 hover:text-red-500"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending} className="min-w-[100px]">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Update" : "Publish"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
