import { AnnouncementList } from "@/components/announcements/AnnouncementList";

export default function StudentAnnouncements() {
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary-foreground"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                                    Announcements
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Updates from your courses and the platform
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="relative">
                    <AnnouncementList isInstructor={false} />
                </div>
            </div>
        </div>
    );
}
