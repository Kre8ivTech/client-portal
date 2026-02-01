import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, BookOpen, PlusCircle, Wrench } from "lucide-react";
import Link from "next/link";

export default async function ServicePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Requests</h1>
        <p className="text-muted-foreground">
          Request new services from the team. For ongoing help or issues, use Support Tickets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              New Service Request
            </CardTitle>
            <CardDescription>Submit a request for a new service or project.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full gap-2">
              <Link href="/dashboard/service/new">
                <PlusCircle className="h-4 w-4" />
                New Service Request
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" />
              Support Tickets
            </CardTitle>
            <CardDescription>View and manage your support tickets for help and issues.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full gap-2">
              <Link href="/dashboard/tickets">
                <Ticket className="h-4 w-4" />
                View Support Tickets
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Knowledge Base
            </CardTitle>
            <CardDescription>Browse articles and guides.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full gap-2">
              <Link href="/dashboard/kb">
                <BookOpen className="h-4 w-4" />
                Browse KB
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
