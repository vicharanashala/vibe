export enum AnnouncementType {
    GENERAL = 'GENERAL',
    VERSION_SPECIFIC = 'VERSION_SPECIFIC',
    COURSE_SPECIFIC = 'COURSE_SPECIFIC',
}

export interface Attachment {
    fileName: string;
    fileUrl: string;
    fileType: string;
}

export interface Announcement {
    _id: string;
    title: string;
    content: string; // HTML or Markdown
    type: AnnouncementType;
    courseId?: string;
    courseVersionId?: string;
    instructorId: string;
    instructorName: string;
    attachments?: Attachment[];
    isHidden: boolean;
    isDeleted?: boolean;
    deletedAt?: string; // Date string
    createdAt: string; // Date string
    updatedAt: string; // Date string
}

export interface CreateAnnouncementBody {
    title: string;
    content: string;
    type: AnnouncementType;
    courseId?: string;
    courseVersionId?: string;
    attachments?: Attachment[];
}

export interface UpdateAnnouncementBody extends Partial<CreateAnnouncementBody> {
    isHidden?: boolean;
}
