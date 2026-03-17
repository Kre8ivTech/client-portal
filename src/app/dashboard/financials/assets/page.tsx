import { requireRole } from "@/lib/require-role";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AssetsPage() {
  await requireRole(["super_admin", "staff"]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Asset Tracking</h2>
          <p className="text-sm text-muted-foreground">
            This feature is currently under development and will be available in a future update.
          </p>
          <Link
            href="/dashboard/financials"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Financials
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
