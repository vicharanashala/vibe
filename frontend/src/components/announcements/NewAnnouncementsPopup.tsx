import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { useAnnouncements } from "@/hooks/announcement-hooks";
import type { Announcement } from "@/types/announcement.types";

// Shared with useNewAnnouncementIndicator so dismissing the popup also clears
// the "new announcements" dot on the bell.
const STORAGE_KEY = "announcements-last-seen";

/**
 * Auto-opening popup that surfaces announcements created since the student last
 * saw them. Renders on dashboard entry; dismissing marks everything up to now
 * as seen so it won't reappear until a newer announcement arrives.
 */
export function NewAnnouncementsPopup() {
  // studentMode=true → GET /announcements/student
  const { data, isLoading } = useAnnouncements(
    undefined,
    undefined,
    undefined,
    true,
  );
  const [open, setOpen] = useState(false);

  const newAnnouncements = useMemo(() => {
    const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    const list = (data as Announcement[] | undefined) ?? [];
    return list
      .filter((a) => !a.isHidden && !a.isDeleted)
      .filter((a) => new Date(a.createdAt).getTime() > lastSeen)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [data]);

  useEffect(() => {
    if (!isLoading && newAnnouncements.length > 0) {
      setOpen(true);
    }
  }, [isLoading, newAnnouncements.length]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    // Let the bell indicator refresh its "hasNew" state.
    window.dispatchEvent(new Event("refresh-announcements"));
    setOpen(false);
  };

  if (newAnnouncements.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? dismiss() : setOpen(o))}>
      <DialogContent className="sm:max-w-lg w-[calc(100%-2rem)] max-w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Megaphone className="h-5 w-5 text-primary" />
            {newAnnouncements.length > 1
              ? `${newAnnouncements.length} new announcements`
              : "New announcement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {newAnnouncements.map((a) => (
            <div
              key={a._id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{a.title}</h3>
                {a.courseName && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {a.courseName}
                  </Badge>
                )}
              </div>
              <div
                className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: a.content }}
              />
              <p className="text-[11px] text-muted-foreground/70">
                {a.instructorName ? `${a.instructorName} · ` : ""}
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={dismiss} className="font-semibold">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
