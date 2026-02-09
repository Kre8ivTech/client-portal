"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface InactivityDialogProps {
  open: boolean;
  onContinue: () => void;
  onStop: () => void;
}

export function InactivityDialog({ open, onContinue, onStop }: InactivityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onStop()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Are you still working?</DialogTitle>
          </div>
          <DialogDescription>
            You have been inactive for 15 minutes. The timer is still running.
            Are you still working on this task?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onStop}
            className="w-full sm:w-auto"
          >
            Stop Timer
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className="w-full sm:w-auto"
          >
            Yes, Still Working
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
