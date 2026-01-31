import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0 [animation-duration:1.5s]" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse uppercase tracking-widest">
        Loading KT-Portal...
      </p>
    </div>
  );
}
