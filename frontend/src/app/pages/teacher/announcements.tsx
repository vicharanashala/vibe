import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { Megaphone } from "lucide-react";

export default function TeacherAnnouncements() {
    return (
        <div className="flex-1 md:p-6 p-3 bg-gradient-to-br from-background via-background to-muted/20">
            <div className="max-w-6xl mx-auto space-y-8 min-w-0">
                {/* Header Section */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
                    <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl md:p-8 p-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg "></div>
                                <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                                    <Megaphone className="h-6 w-6 text-primary-foreground" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                                    Announcements
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Manage announcements across your courses
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="relative">
                    <AnnouncementList isInstructor={true} />
                </div>
            </div>
        </div>
    );
}
