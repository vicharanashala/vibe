import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { PageHeader } from "@/components/layout/PageHeader";

export default function StudentAnnouncements() {
    return (
        <div className="flex-1">
            <div className="space-y-8 min-w-0">
                <PageHeader
                    title="Announcements"
                    description="Updates from your courses and the platform"
                />
                <AnnouncementList isInstructor={false} />
            </div>
        </div>
    );
}
