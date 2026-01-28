import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Users } from "lucide-react";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Clients
          </h2>
          <p className="text-slate-500">
            Manage your agency partners and direct client organizations.
          </p>
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Add Organization
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Clients"
          value="48"
          icon={<Users className="text-slate-400" size={20} />}
        />
        <StatsCard
          title="Active Partners"
          value="6"
          icon={<Users className="text-slate-400" size={20} />}
        />
        <StatsCard
          title="New this month"
          value="+4"
          icon={<Users className="text-slate-400" size={20} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Directory</CardTitle>
          <CardDescription>
            All organizations under your management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
            Client directory/list will be implemented here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
