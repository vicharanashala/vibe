export enum AnnouncementType {
    GENERAL = 'GENERAL',
    VERSION_SPECIFIC = 'VERSION_SPECIFIC',
    COURSE_SPECIFIC = 'COURSE_SPECIFIC',
    COHORT_SPECIFIC = 'COHORT_SPECIFIC',
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
    courseName?: string;
    courseVersionName?: string;
    instructorId: string;
    instructorName: string;
    instructorFirebaseUid?: string;
    attachments?: Attachment[];
    isHidden: boolean;
    isDeleted?: boolean;
    deletedAt?: string; // Date string
    createdAt: string; // Date string
    updatedAt: string; // Date string
    cohortId?: string;
    cohortName?: string;
}

export interface CreateAnnouncementBody {
    title: string;
    content: string;
    type: AnnouncementType;
    courseId?: string;
    courseVersionId?: string;
    attachments?: Attachment[];
    cohortId?: string;
    cohortName?: string;
}

export interface UpdateAnnouncementBody extends Partial<CreateAnnouncementBody> {
    isHidden?: boolean;
}
