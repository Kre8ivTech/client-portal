export function SiteMonitorEmptyState() {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center shadow-sm md:py-14">
      <h3 className="text-base font-semibold tracking-tight">No sites are listed yet</h3>
      <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
        Add a client site to track uptime, SSL, and WordPress plugins. Status stays unknown until a check is recorded.
      </p>
    </div>
  );
}
