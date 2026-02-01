"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTimeEntry } from "@/lib/actions/time-entries";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export function TimeEntryDeleteButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this time entry?")) return;
    setDeleting(true);
    try {
      await deleteTimeEntry(entryId);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-destructive hover:text-destructive"
      onClick={handleDelete}
      disabled={deleting}
      aria-label="Delete"
    >
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
