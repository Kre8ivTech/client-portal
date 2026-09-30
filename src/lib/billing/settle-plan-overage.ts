import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { overagePeriodKey, overageToBill } from "@/lib/billing/plan-overage";

type PlanRow = {
  name?: string;
  support_hours_included?: number | null;
  dev_hours_included?: number | null;
  support_hourly_rate?: number | null;
  dev_hourly_rate?: number | null;
};

type AssignmentRow = {
  id: string;
  organization_id: string;
  support_hours_used: number | null;
  dev_hours_used: number | null;
  plans: PlanRow | PlanRow[] | null;
};

function planOf(value: PlanRow | PlanRow[] | null): PlanRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function settlePlanOverage(input: {
  planAssignmentId: string;
  workType: "support" | "dev";
  actorId: string;
  now?: Date;
}): Promise<{ billed: boolean; hours: number; amountCents: number; invoiceId?: string; error?: string }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("plan_assignments")
    .select("id, organization_id, support_hours_used, dev_hours_used, plans(name, support_hours_included, dev_hours_included, support_hourly_rate, dev_hourly_rate)")
    .eq("id", input.planAssignmentId)
    .maybeSingle();

  if (error || !data) return { billed: false, hours: 0, amountCents: 0, error: error?.message || "Plan not found" };

  const assignment = data as AssignmentRow;
  const plan = planOf(assignment.plans);
  const used = input.workType === "support" ? Number(assignment.support_hours_used ?? 0) : Number(assignment.dev_hours_used ?? 0);
  const included = input.workType === "support" ? Number(plan?.support_hours_included ?? 0) : Number(plan?.dev_hours_included ?? 0);
  const rate = input.workType === "support" ? Number(plan?.support_hourly_rate ?? 0) : Number(plan?.dev_hourly_rate ?? 0);
  const periodKey = overagePeriodKey(input.now ?? new Date());

  const { data: ledger } = await admin
    .from("plan_overage_ledgers")
    .select("id, hours_billed")
    .eq("plan_assignment_id", assignment.id)
    .eq("work_type", input.workType)
    .eq("period_key", periodKey)
    .maybeSingle();
  const billedHours = Number((ledger as { hours_billed?: number } | null)?.hours_billed ?? 0);
  const bill = overageToBill({ usedHours: used, includedHours: included, billedHours, hourlyRateCents: rate });
  if (bill.hours <= 0) return { billed: false, hours: 0, amountCents: 0 };

  const label = input.workType === "support" ? "Support" : "Development";
  let invoiceId: string | undefined;
  if (bill.amountCents > 0) {
    const invoiceNumber = `OVR-${periodKey.replace("-", "")}-${input.workType.toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const due = new Date(input.now ?? new Date());
    due.setUTCDate(due.getUTCDate() + 15);
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        organization_id: assignment.organization_id,
        plan_assignment_id: assignment.id,
        invoice_number: invoiceNumber,
        status: "sent",
        issue_date: (input.now ?? new Date()).toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
        subtotal: bill.amountCents,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total: bill.amountCents,
        amount_paid: 0,
        balance_due: bill.amountCents,
        payment_terms_days: 15,
        notes: `${label} hours beyond the ${plan?.name || "care"} plan for ${periodKey}.`,
        created_by: input.actorId,
        updated_by: input.actorId,
        sent_at: (input.now ?? new Date()).toISOString(),
      })
      .select("id")
      .single();
    if (invoiceError || !invoice) return { billed: false, hours: bill.hours, amountCents: 0, error: invoiceError?.message || "Invoice failed" };
    invoiceId = (invoice as { id: string }).id;
    const { error: lineError } = await admin.from("invoice_line_items").insert({
      invoice_id: invoiceId,
      description: `${label} overage (${bill.hours} hours)`,
      quantity: bill.hours,
      unit_price: rate,
      amount: bill.amountCents,
      item_type: "overage",
    });
    if (lineError) {
      await admin.from("invoices").delete().eq("id", invoiceId);
      return { billed: false, hours: bill.hours, amountCents: 0, error: lineError.message };
    }
  }

  const nextHours = Math.round((billedHours + bill.hours) * 100) / 100;
  if (ledger && (ledger as { id: string }).id) {
    await admin
      .from("plan_overage_ledgers")
      .update({ hours_billed: nextHours, last_invoice_id: invoiceId ?? null, updated_at: new Date().toISOString() })
      .eq("id", (ledger as { id: string }).id);
  } else {
    await admin.from("plan_overage_ledgers").insert({
      plan_assignment_id: assignment.id,
      organization_id: assignment.organization_id,
      work_type: input.workType,
      period_key: periodKey,
      hours_billed: nextHours,
      last_invoice_id: invoiceId ?? null,
    });
  }

  const dollars = (bill.amountCents / 100).toFixed(2);
  const content = bill.amountCents > 0
    ? `${label} hours are past the included amount. An invoice for $${dollars} (${bill.hours} hours) is ready.`
    : `${label} hours are past the included amount by ${bill.hours} hours. No hourly rate is set, so no invoice was created.`;

  const { error: noticeError } = await admin.from("notifications").insert({
    title: `${label} hours exceeded`,
    content,
    type: "client_specific",
    target_audience: "specific_organizations",
    target_organization_ids: [assignment.organization_id],
    priority: "warning",
    created_by: input.actorId,
    is_active: true,
  });
  if (noticeError) {
    return { billed: true, hours: bill.hours, amountCents: bill.amountCents, invoiceId, error: noticeError.message };
  }

  return { billed: true, hours: bill.hours, amountCents: bill.amountCents, invoiceId };
}
