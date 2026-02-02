import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSignature, DollarSign, Calendar, Users } from "lucide-react";
import Link from "next/link";

export default async function ContractsFinancialPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();

  // Fetch contracts
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, title, status, total_value, start_date, end_date, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { count: totalContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true });

  const { count: activeContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Calculate total contract value
  const totalValue = contracts?.reduce((sum, c) => sum + (c.total_value || 0), 0) || 0;
  const activeValue = contracts
    ?.filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (c.total_value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contracts & Client Agreements</h1>
        <p className="text-muted-foreground">
          Track client contracts, terms, and financial commitments
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalValue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All contracts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Value</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(activeValue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active contracts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContracts ?? 0}</div>
            <p className="text-xs text-muted-foreground">{activeContracts ?? 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Contract Value</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalContracts ? ((totalValue / totalContracts) / 100).toLocaleString() : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">Per contract</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Contracts</CardTitle>
          <CardDescription>Latest client agreements and contracts</CardDescription>
        </CardHeader>
        <CardContent>
          {!contracts?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No contracts found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/contracts/${contract.id}`}
                        className="hover:underline"
                      >
                        {contract.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      ${((contract.total_value || 0) / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          contract.status === "active"
                            ? "default"
                            : contract.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.start_date
                        ? new Date(contract.start_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {contract.end_date
                        ? new Date(contract.end_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
