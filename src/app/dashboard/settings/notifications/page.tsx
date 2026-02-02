import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";

export default async function NotificationsSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Notification Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage how and when you receive notifications.
        </p>
      </div>

      <div className="grid gap-8">
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="text-primary w-5 h-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose which email notifications you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ticket-updates">Ticket Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when tickets are updated
                </p>
              </div>
              <Switch id="ticket-updates" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="invoice-reminders">Invoice Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminders about upcoming or overdue invoices
                </p>
              </div>
              <Switch id="invoice-reminders" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-messages">New Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Notification when you receive new messages
                </p>
              </div>
              <Switch id="new-messages" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="contract-updates">Contract Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Updates about contract status and renewals
                </p>
              </div>
              <Switch id="contract-updates" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="text-primary w-5 h-5" />
              In-App Notifications
            </CardTitle>
            <CardDescription>
              Manage notifications that appear within the application.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser push notifications
                </p>
              </div>
              <Switch id="push-notifications" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound-alerts">Sound Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Play a sound when receiving notifications
                </p>
              </div>
              <Switch id="sound-alerts" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
