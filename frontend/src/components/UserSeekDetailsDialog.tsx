import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SkipBack, SkipForward, Clock } from 'lucide-react';
import { IUserActivityEvent } from '@/types/user_activity_event.types';
import { useUserActivityEvents } from '@/hooks/hooks';

interface UserSeekDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser: any;
  videoId: string;
  courseId: string;
  versionId: string;
}

export function UserSeekDetailsDialog({
  open,
  onOpenChange,
  selectedUser,
  videoId,
  courseId,
  versionId
}: UserSeekDetailsDialogProps) {

  // Only call API when we have a selected user and valid IDs
  const shouldCallAPI = selectedUser &&
    selectedUser.userId &&
    typeof selectedUser.userId === 'string' &&
    selectedUser.userId.length === 24 &&
    videoId &&
    typeof videoId === 'string' &&
    videoId.length === 24;

  const { data: activityEvents, isLoading, error } = useUserActivityEvents(
    shouldCallAPI ? selectedUser.userId : undefined,
    shouldCallAPI ? videoId : undefined,
    courseId,
    versionId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seek Details - {selectedUser?.firstName}</DialogTitle>
          <DialogDescription>
            View detailed seek activity for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading seek details...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Failed to load seek details: {error}
            </div>
          ) : activityEvents && activityEvents.length > 0 ? (
            <>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Rewinds Card */}
                <div className="relative overflow-hidden bg-blue-50 p-3 rounded-xl border border-blue-200 flex flex-col justify-between min-h-[64px]">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Rewinds</span>
                    <div className="bg-blue-600 text-white rounded-full p-1 shadow-sm">
                      <SkipBack className="h-2.5 w-2.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-blue-900 leading-none mt-1">
                    {activityEvents[0]?.rewinds || 0}
                  </div>
                </div>

                {/* Forwards Card */}
                <div className="relative overflow-hidden bg-green-50 p-3 rounded-xl border border-green-200 flex flex-col justify-between min-h-[64px]">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">Forwards</span>
                    <div className="bg-green-600 text-white rounded-full p-1 shadow-sm">
                      <SkipForward className="h-2.5 w-2.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-green-900 leading-none mt-1">
                    {activityEvents[0]?.fastForwards || 0}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">
                  Activity Timeline
                </div>
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {/* Combine and sort all events by time */}
                    {(() => {
                      const allEvents: Array<{
                        from: string;
                        to: string;
                        createdAt: string;
                        type: 'rewind' | 'forward';
                        originalIndex: number;
                      }> = [];

                      // Add rewind events
                      if (activityEvents[0].rewindData && Array.isArray(activityEvents[0].rewindData)) {
                        activityEvents[0].rewindData.forEach((rewind, index) => {
                          allEvents.push({
                            ...rewind,
                            type: 'rewind',
                            originalIndex: index
                          });
                        });
                      }

                      // Add fast forward events
                      if (activityEvents[0].fastForwardData && Array.isArray(activityEvents[0].fastForwardData)) {
                        activityEvents[0].fastForwardData.forEach((forward, index) => {
                          allEvents.push({
                            ...forward,
                            type: 'forward',
                            originalIndex: index
                          });
                        });
                      }

                      // Sort by creation time
                      return allEvents.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    })().map((event) => (
                      <div
                        key={`${event.type}-${event.originalIndex}`}
                        className="flex items-center justify-between py-2 px-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Icon Container - Increased size for better touch/visibility */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${event.type === 'rewind'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                            }`}>
                            {event.type === 'rewind' ? (
                              <SkipBack className="h-4 w-4" />
                            ) : (
                              <SkipForward className="h-4 w-4" />
                            )}
                          </div>

                          {/* Content - Label and Timeline */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm font-medium text-white capitalize w-16">
                              {event.type}
                            </span>
                            <span className="text-sm font-semibold text-white tracking-tight">
                              {event.from} — {event.to}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp - Right Aligned */}
                        <div className="text-xs font-medium text-gray-400 tabular-nums ml-4">
                          {new Date(event.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit', // Added seconds to match the precision in the image
                            hour12: true
                          })}
                        </div>
                      </div>
                    ))}

                    {/* No events case */}
                    {(!activityEvents[0].rewindData || !Array.isArray(activityEvents[0].rewindData) || activityEvents[0].rewindData.length === 0) &&
                      (!activityEvents[0].fastForwardData || !Array.isArray(activityEvents[0].fastForwardData) || activityEvents[0].fastForwardData.length === 0) && (
                        <div className="text-center py-12 text-gray-500">
                          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <div className="text-sm font-medium">No seek events recorded</div>
                          <div className="text-xs mt-1">User hasn't skipped any video sections</div>
                        </div>
                      )}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No seek events recorded
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
