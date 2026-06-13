import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/selia/dialog";
import { Button } from "@/components/selia/button";
import type { ImportLogEntry } from "@/lib/types";

interface DeleteBatchModalProps {
  entry: ImportLogEntry | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function DeleteBatchModal({ entry, onClose, onConfirm }: DeleteBatchModalProps) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      {entry && (
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Delete Import Batch</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              This will permanently delete {entry.row_count.toLocaleString("id-ID")} transaction rows
              imported from "{entry.filename}". This cannot be undone.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm(entry.id);
                onClose();
              }}
            >
              Delete Records
            </Button>
          </DialogFooter>
        </DialogPopup>
      )}
    </Dialog>
  );
}
