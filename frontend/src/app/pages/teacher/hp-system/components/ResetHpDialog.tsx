import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
  SelectValue,
} from "@/components/ui/select";
import { useResetHp } from "@/hooks/hooks";
import { toast } from "sonner";
import ConfirmationModal from "../../components/confirmation-modal";

type ResetMode = "ALL" | "ONLY_ZERO_HP" | "ONLY_WITH_HP";

interface ResetHpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseVersionId: string;
  cohortName: string;
  onSuccess?: () => void;
}

export function ResetHpDialog({
  open,
  onOpenChange,
  courseVersionId,
  cohortName,
  onSuccess,
}: ResetHpDialogProps) {
  const [mode, setMode] = useState<ResetMode>("ALL");
  const [targetHp, setTargetHp] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);

  const {mutateAsync:resetMutation , isPending:isResetting}= useResetHp();

  const handleSubmit = () => {
    if (targetHp < 0) {
      setError("HP cannot be negative");
      return;
    }

    setError(null);
    setOpenConfirm(true);
  };

  const handleConfirm = async () => {
    try {
      setOpenConfirm(false);
      const documentsUpdated = await resetMutation({
        courseVersionId,
        cohortName,
        mode,
        targetHp,
      });

      toast.success(`Updated HP of ${documentsUpdated} students`);
      onOpenChange(false)
      onSuccess?.();
    } catch (err: any) {
        console.log(err)
      toast.error(err?.message || "Failed to reset HP");
    }
  };

  return (
    <>
      {/* Config Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Reset HP</DialogTitle>
            <DialogDescription>
              Update HP points for multiple students at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reset Mode</label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as ResetMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Students</SelectItem>
                  <SelectItem value="ONLY_ZERO_HP">
                    Only students with 0 HP
                  </SelectItem>
                  <SelectItem value="ONLY_WITH_HP">
                    Only students with existing HP
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Set HP Value</label>
              <Input
                type="number"
                value={targetHp}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setTargetHp(value);

                  if (value < 0) {
                    setError("HP cannot be negative");
                  } else {
                    setError(null);
                  }
                }}
                min={0}
              />

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            <Button onClick={handleSubmit} disabled={!!error || isResetting}>
              { isResetting? "Resetting..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openConfirm}
        onClose={() => {
            setOpenConfirm(false);
            onOpenChange(true);
        }}
        onConfirm={handleConfirm}
        title="Confirm HP Reset"
        description={`This will reset HP for students. This action cannot be undone.\n Are you sure you want to continue?`}
        confirmText="Reset HP"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={isResetting}
        loadingText="Resetting..."
      />
    </>
  );
}