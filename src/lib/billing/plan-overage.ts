export type OverageBill = {
  hours: number;
  amountCents: number;
};

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function overageToBill(input: {
  usedHours: number;
  includedHours: number;
  billedHours: number;
  hourlyRateCents: number;
}): OverageBill {
  const excess = Math.max(0, input.usedHours - input.includedHours);
  const hours = roundHours(Math.max(0, excess - input.billedHours));
  if (hours <= 0) return { hours: 0, amountCents: 0 };
  if (input.hourlyRateCents <= 0) return { hours, amountCents: 0 };
  return { hours, amountCents: Math.round(hours * input.hourlyRateCents) };
}

export function overagePeriodKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}
