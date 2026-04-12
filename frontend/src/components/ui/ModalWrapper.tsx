import { Dialog, DialogContent } from "@/components/ui/dialog";
import React from "react";

export function ModalWrapper({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl p-6 rounded-lg bg-white z-50">
        {children}
      </DialogContent>
    </Dialog>
  );
}
