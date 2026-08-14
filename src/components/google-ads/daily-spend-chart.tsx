type SpendPoint = {
  date: string;
  costMicros: number;
};

export function DailySpendChart({ points, currencyCode }: { points: SpendPoint[]; currencyCode: string }) {
  const visible = points.slice(-14);
  const maximum = Math.max(...visible.map((point) => point.costMicros), 1);
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  });

  if (visible.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No daily spend has been synced yet.</p>;
  }

  return (
    <div className="space-y-3" aria-label="Daily Google Ads spend for the last 14 days">
      <div className="flex h-44 items-end gap-1.5 border-b border-l px-2 pt-3 sm:gap-2">
        {visible.map((point) => {
          const amount = point.costMicros / 1_000_000;
          const height = Math.max((point.costMicros / maximum) * 100, point.costMicros > 0 ? 4 : 1);
          return (
            <div key={point.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-primary/75 transition-colors group-hover:bg-primary"
                style={{ height: `${height}%` }}
                title={`${point.date}: ${currency.format(amount)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{visible[0]?.date}</span>
        <span>{visible[visible.length - 1]?.date}</span>
      </div>
    </div>
  );
}
