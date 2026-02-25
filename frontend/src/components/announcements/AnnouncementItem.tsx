import { Announcement } from "@/types/announcement.types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Paperclip, Edit, Trash2, EyeOff, Eye } from "lucide-react";
import { cn } from "@/utils/utils";
import { useAuthStore } from "@/store/auth-store";

interface AnnouncementItemProps {
    announcement: Announcement;
    isInstructor?: boolean;
    isAdmin?: boolean;
    onEdit?: (a: Announcement) => void;
    onDelete?: (id: string) => void;
    onToggleHide?: (id: string) => void;
}

export function AnnouncementItem({ announcement, isInstructor, isAdmin, onEdit, onDelete, onToggleHide }: AnnouncementItemProps) {
    const { user } = useAuthStore();
    // Show modification buttons only to the creator (matched by Firebase UID) or admin
    const canModify = isInstructor && (
        isAdmin ||
        user?.uid === announcement.instructorFirebaseUid
    );
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300 hover:shadow-md border-l-4 border-l-primary/50",
            announcement.isHidden && "opacity-60"
        )}>
            <CardHeader className="pb-3 space-y-0">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex gap-3 items-start">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm mt-1">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${announcement.instructorName}`} />
                            <AvatarFallback>{getInitials(announcement.instructorName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-lg font-bold leading-tight flex items-center gap-2">
                                {announcement.title}
                                {announcement.isHidden && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex gap-1">
                                        <EyeOff className="h-3 w-3" /> Hidden
                                    </Badge>
                                )}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <span className="font-medium text-foreground">{announcement.instructorName}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(announcement.createdAt)}
                                </span>
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">
                                    {announcement.type.replace('_', ' ')}
                                </Badge>
                                {announcement.courseName && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                        {announcement.courseName}
                                    </Badge>
                                )}
                                {announcement.courseVersionName && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                        v: {announcement.courseVersionName}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {canModify && (
                        <div className="flex gap-1 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                                onClick={() => onToggleHide?.(announcement._id)}
                                title={announcement.isHidden ? "Show announcement" : "Hide announcement"}
                            >
                                {announcement.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onEdit?.(announcement)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(announcement._id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pb-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground/90">
                <div dangerouslySetInnerHTML={{ __html: announcement.content }} />
            </CardContent>

            {announcement.attachments && announcement.attachments.length > 0 && (
                <CardFooter className="pt-0 flex flex-wrap gap-2">
                    {announcement.attachments.map((att, idx) => (
                        <Button key={idx} variant="outline" size="sm" className="h-8 text-xs gap-2" asChild>
                            <a href={att.fileUrl} target="_blank" rel="noreferrer">
                                <Paperclip className="h-3.5 w-3.5 opacity-70" />
                                {att.fileName}
                            </a>
                        </Button>
                    ))}
                </CardFooter>
            )}
        </Card>
    );
}
