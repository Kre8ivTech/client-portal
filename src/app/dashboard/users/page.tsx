import { requireRole } from "@/lib/require-role";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserTable } from "@/components/admin/user-table";

export default async function UserManagementPage() {
  const { role, isAccountManager } = await requireRole(["super_admin", "staff"]);

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4 flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          User Management
        </h2>
        <p className="text-slate-500 mt-2">
          Manage users, reset passwords, and create new user accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all users in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable 
            currentUserRole={role} 
            isAccountManager={isAccountManager}
          />
        </CardContent>
      </Card>
    </div>
  );
}

