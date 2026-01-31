export default function TicketDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-5 w-32 bg-slate-200 rounded" />
      <div className="flex gap-3">
        <div className="h-6 w-24 bg-slate-200 rounded" />
        <div className="h-6 w-20 bg-slate-200 rounded" />
        <div className="h-6 w-16 bg-slate-200 rounded" />
      </div>
      <div className="h-8 w-3/4 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-48 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
