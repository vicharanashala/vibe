import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetAppealById } from "@/hooks/system-notification-hooks";
import { Dialog } from "@/components/ui/dialog";

export function AppealDetailsModal({ open, onClose, notification }) {
  const appealId = notification.extra?.appealId;

  const { data, isLoading } = useGetAppealById(
    appealId,
    open // only fetch when modal opens
  );
  console.log('data:', data);
 
  

  if (isLoading) {
    return <Dialog open={open}><DialogContent>Loading...</DialogContent></Dialog>;
  }

  const appeal = data;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Appeal Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">

          <div>
            <p className="font-medium">Reason</p>
            <p className="text-muted-foreground mt-1">
              {appeal?.reason}
            </p>
          </div>

          {appeal?.evidenceUrl && (
            <div>
              <p className="font-medium">Evidence</p>
              <a
                href={appeal.evidenceUrl}
                target="_blank"
                className="text-blue-500 underline"
              >
                Open Evidence Link
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}