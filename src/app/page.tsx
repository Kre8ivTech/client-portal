export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          KT-Portal v2.0
        </h1>
        <p className="mt-4 text-muted-foreground text-lg">
          Kre8ivTech Client Portal - Foundation Established
        </p>
      </div>
      
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Multi-Tenancy</h2>
          <p className="text-sm text-muted-foreground">Row-level security and organization isolation built-in.</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Real-Time</h2>
          <p className="text-sm text-muted-foreground">Live updates for tickets and queue positions.</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">White-Label</h2>
          <p className="text-sm text-muted-foreground">Custom branding for agency partners.</p>
        </div>
      </div>
    </main>
  );
}
