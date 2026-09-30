"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitTicketSatisfaction } from "@/lib/actions/ticket-satisfaction";

export function TicketSatisfaction({
  ticketId,
  rating,
  comment,
  canRate,
}: {
  ticketId: string;
  rating: number | null;
  comment: string | null;
  canRate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score, setScore] = useState(rating ? String(rating) : "5");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (rating != null) {
    return (
      <section className="rounded-lg border p-4">
        <h3 className="font-semibold">Satisfaction</h3>
        <p className="mt-1 text-sm">Rated {rating} out of 5.</p>
        {comment ? <p className="mt-2 text-sm text-muted-foreground">{comment}</p> : null}
      </section>
    );
  }

  if (!canRate) return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const note = String(new FormData(formElement).get("comment") || "");
    startTransition(async () => {
      const result = await submitTicketSatisfaction({ ticketId, rating: Number(score), comment: note });
      if (!result.success) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError(null);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
      <fieldset className="space-y-2">
        <legend className="font-semibold">How did we do?</legend>
        <p className="text-sm text-muted-foreground">This ticket is resolved. A rating helps the team improve.</p>
        <div className="flex flex-wrap gap-3">
          {["1", "2", "3", "4", "5"].map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="rating" value={value} checked={score === value} onChange={() => setScore(value)} />
              {value}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="satisfaction-comment">Comment</Label>
        <Textarea id="satisfaction-comment" name="comment" rows={3} maxLength={1000} />
      </div>
      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {saved ? <p>Thanks, the rating is saved.</p> : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Submit rating"}
      </Button>
    </form>
  );
}
