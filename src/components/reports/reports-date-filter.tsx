"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ReportsDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const from = searchParams.get("from") ?? formatDate(defaultStart);
  const to = searchParams.get("to") ?? formatDate(defaultEnd);

  function handleApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fromInput = form.querySelector<HTMLInputElement>('input[name="from"]');
    const toInput = form.querySelector<HTMLInputElement>('input[name="to"]');
    const fromVal = fromInput?.value ?? from;
    const toVal = toInput?.value ?? to;
    router.push(`/dashboard/reports?from=${fromVal}&to=${toVal}`);
  }

  const exportHref = `/api/reports/export?from=${from}&to=${to}`;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <form onSubmit={handleApply} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="w-[140px]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="w-[140px]" />
        </div>
        <Button type="submit" variant="secondary" size="sm">Apply</Button>
      </form>
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <a href={exportHref} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </Button>
    </div>
  );
}
