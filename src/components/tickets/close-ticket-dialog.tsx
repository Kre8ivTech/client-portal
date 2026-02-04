"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { closeTicketWithNote } from "@/lib/actions/tickets";

interface CloseTicketDialogProps {
  ticketId: string;
  ticketNumber: number;
  onClose?: () => void;
  isStaff?: boolean;
}

export function CloseTicketDialog({ ticketId, ticketNumber, onClose, isStaff = false }: CloseTicketDialogProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClose = async () => {
    if (isSubmitting) return;

    // Require justification for clients
    if (!isStaff && note.trim().length < 10) {
      setError("Please provide a reason for closing this ticket (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await closeTicketWithNote(ticketId, {
      note: note.trim() || undefined,
      isInternal: isStaff ? isInternal : false,
    });

    if (result.success) {
      setOpen(false);
      setNote("");
      setIsInternal(false);
      router.refresh();
      onClose?.();
    } else {
      setError(result.error || "Failed to close ticket");
    }

    setIsSubmitting(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      setOpen(newOpen);
      if (!newOpen) {
        setNote("");
        setIsInternal(false);
        setError(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CheckCircle className="h-4 w-4" />
          Close Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Ticket #{ticketNumber}</DialogTitle>
          <DialogDescription>Mark this ticket as closed. You can optionally add a resolution note.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="close-note">
              {isStaff ? "Resolution Note (optional)" : "Reason for Closing (required)"}
            </Label>
            <Textarea
              id="close-note"
              placeholder={
                isStaff ? "Add a note explaining the resolution..." : "Please explain why you're closing this ticket..."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isSubmitting}
            />
            {!isStaff && note.trim().length < 10 && note.trim().length > 0 && (
              <p className="text-xs text-orange-600">
                Please provide at least 10 characters explaining why you're closing this ticket.
              </p>
            )}
          </div>

          {isStaff && (
            <div className="flex items-center gap-2">
              <Switch
                id="internal-close-note"
                checked={isInternal}
                onCheckedChange={setIsInternal}
                disabled={isSubmitting}
              />
              <Label htmlFor="internal-close-note" className="text-sm font-medium text-slate-600 cursor-pointer">
                Mark as internal note (Staff only)
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={isSubmitting || (!isStaff && note.trim().length < 10)}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              "Close Ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
