"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Plus, Loader2 } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  support_hours_included: number;
  dev_hours_included: number;
  monthly_fee: number;
  currency: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

interface AssignPlanModalProps {
  organizationId?: string;
  onSuccess?: () => void;
}

export function AssignPlanModal({ organizationId, onSuccess }: AssignPlanModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [billingCycleDay, setBillingCycleDay] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("id, name, description, support_hours_included, dev_hours_included, monthly_fee, currency")
        .eq("is_active", true)
        .order("name");

      if (plansError) throw plansError;
      setPlans(plansData || []);

      // Fetch organizations (if not pre-selected)
      if (!organizationId) {
        const { data: orgsData, error: orgsError } = await supabase
          .from("organizations")
          .select("id, name, slug, type")
          .in("type", ["client", "partner"])
          .eq("status", "active")
          .order("name");

        if (orgsError) throw orgsError;
        setOrganizations(orgsData || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/plan-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          organization_id: selectedOrgId,
          start_date: startDate,
          billing_cycle_day: billingCycleDay,
          auto_renew: autoRenew,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign plan");
      }

      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign plan");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Assign Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Plan to Organization</DialogTitle>
          <DialogDescription>
            Create a new plan assignment for an organization. This will start billing them according to the selected plan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!organizationId && (
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <select
                  id="organization"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select an organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a plan...</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - ${(plan.monthly_fee / 100).toFixed(2)}/mo
                  </option>
                ))}
              </select>
            </div>

            {selectedPlan && (
              <div className="p-3 bg-slate-50 rounded-lg border text-sm">
                <div className="font-medium text-slate-900">{selectedPlan.name}</div>
                {selectedPlan.description && (
                  <p className="text-slate-600 mt-1">{selectedPlan.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                  <div>
                    <div className="text-xs text-slate-500">Support Hours</div>
                    <div className="font-semibold">{selectedPlan.support_hours_included} hrs/mo</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Dev Hours</div>
                    <div className="font-semibold">{selectedPlan.dev_hours_included} hrs/mo</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_day">Billing Day</Label>
                <Input
                  id="billing_day"
                  type="number"
                  min={1}
                  max={28}
                  value={billingCycleDay}
                  onChange={(e) => setBillingCycleDay(parseInt(e.target.value) || 1)}
                  required
                />
                <p className="text-xs text-muted-foreground">Day of month (1-28)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_renew"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="auto_renew" className="font-normal">
                Auto-renew subscription each billing cycle
              </Label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedPlanId || !selectedOrgId}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Plan"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
