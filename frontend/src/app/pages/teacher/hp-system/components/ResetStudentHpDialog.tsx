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
import { useResetStudentHp } from "@/hooks/hooks";
import { toast } from "sonner";
import ConfirmationModal from "../../components/confirmation-modal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  courseVersionId: string;
  cohortName: string;
  onSuccess?: () => void;
}

export function ResetStudentHpDialog({
  open,
  onOpenChange,
  student,
  courseVersionId,
  cohortName,
  onSuccess,
}: Props) {
  const [targetHp, setTargetHp] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);

  const { mutateAsync: resetMutation, isPending: isResetting } =
    useResetStudentHp();

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

      await resetMutation({
        courseVersionId,
        cohortName,
        studentId: student._id,
        targetHp,
      });

      toast.success(`HP updated for ${student.name}`);
      setTargetHp(0);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.log(err);
      toast.error(err?.message || "Failed to reset HP");
    }
  };

  if (!student) return null;

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>Reset Student HP</DialogTitle>
            <DialogDescription>
              Update HP for <span className="font-medium">{student.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!!error || isResetting}
            >
              {isResetting ? "Resetting..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={openConfirm}
        onClose={() => {
          setOpenConfirm(false);
          onOpenChange(true);
        }}
        onConfirm={handleConfirm}
        title="Confirm Student HP Reset"
        description={`This will reset HP for ${student.name}. This action cannot be undone.\nAre you sure you want to continue?`}
        confirmText="Reset HP"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={isResetting}
        loadingText="Resetting..."
      />
    </>
  );
}