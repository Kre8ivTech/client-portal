import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, BookOpen, MessageSquare, PlusCircle } from "lucide-react";
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
        <h1 className="text-2xl font-bold tracking-tight">Service</h1>
        <p className="text-muted-foreground">
          Get help, open tickets, and find answers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" />
              Tickets
            </CardTitle>
            <CardDescription>View and manage your support tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full gap-2">
              <Link href="/dashboard/tickets">
                <Ticket className="h-4 w-4" />
                View Tickets
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-4 w-4" />
              New Request
            </CardTitle>
            <CardDescription>Open a new support ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full gap-2">
              <Link href="/dashboard/tickets/new">
                <PlusCircle className="h-4 w-4" />
                New Ticket
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
