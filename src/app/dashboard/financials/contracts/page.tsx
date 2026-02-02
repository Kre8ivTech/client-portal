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
    .select("id, title, status, signed_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { count: totalContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true });

  const { count: signedContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "signed");

  const { count: pendingContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_signature");

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
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContracts ?? 0}</div>
            <p className="text-xs text-muted-foreground">All contracts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{signedContracts ?? 0}</div>
            <p className="text-xs text-muted-foreground">Fully executed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Signature</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingContracts ?? 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting signatures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalContracts ? Math.round(((signedContracts ?? 0) / totalContracts) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Signed rate</p>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Date</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
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
                      <Badge
                        variant={
                          contract.status === "signed"
                            ? "default"
                            : contract.status === "pending_signature"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.signed_at
                        ? new Date(contract.signed_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {contract.expires_at
                        ? new Date(contract.expires_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(contract.created_at).toLocaleDateString()}
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
