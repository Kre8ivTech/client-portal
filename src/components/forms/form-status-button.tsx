"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFormStatus } from "@/lib/actions/forms";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";

type Status = "draft" | "active" | "archived";

export function FormStatusButton({ formId, currentStatus }: { formId: string; currentStatus: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function handleStatus(status: Status) {
    setUpdating(true);
    try {
      await updateFormStatus(formId, status);
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" disabled={updating}>
          {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Status
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleStatus("draft")} disabled={currentStatus === "draft"}>
          Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatus("active")} disabled={currentStatus === "active"}>
          Active
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatus("archived")} disabled={currentStatus === "archived"}>
          Archived
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
