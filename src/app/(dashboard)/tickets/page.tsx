import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Tickets
          </h2>
          <p className="text-slate-500">
            Manage support requests and track queue positions.
          </p>
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Create Ticket
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Open Tickets" value="12" />
        <StatsCard title="Avg. Response" value="2.4h" />
        <StatsCard title="Waitlist" value="5" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tickets</CardTitle>
          <CardDescription>
            A list of your recent support queries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
            Ticket list component will be implemented here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
