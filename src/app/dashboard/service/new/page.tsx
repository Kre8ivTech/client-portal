import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ArrowLeft } from "lucide-react";

export default function NewServiceRequestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Service Request</h1>
        <p className="text-muted-foreground">
          Request a new service or project from the team. This is separate from support tickets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service request form
          </CardTitle>
          <CardDescription>
            Describe the service you need. Your request will be reviewed and someone will follow up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            The service request form is under construction. For now, you can open a support ticket
            to describe your request, or contact your account manager.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/service">
                <ArrowLeft className="h-4 w-4" />
                Back to Service Requests
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/dashboard/tickets/new">Open a support ticket instead</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
