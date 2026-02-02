import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export function AdminAccessInfo() {
  return (
    <Card className="border-border shadow-sm bg-muted/20">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Shield className="text-primary w-5 h-5" />
          Admin account
        </CardTitle>
        <CardDescription>
          You are signed in as a portal administrator. There is no separate admin login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Everyone signs in the same way (magic link). Admin access is determined by your profile
          role in the database. To grant admin to a user, set their <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">role</code> to{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">super_admin</code> in the{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">users</code> table
          (Supabase Dashboard → Table Editor → users). You can also manage this in-app via{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Dashboard → User Management</code>.
        </p>
        <p className="text-xs">
          Or run in SQL:{" "}
          <code className="block mt-1 rounded bg-muted p-2 font-mono text-[11px] break-all">
            UPDATE public.users SET role = 'super_admin' WHERE email = 'your@email.com';
          </code>
        </p>
      </CardContent>
    </Card>
  );
}
