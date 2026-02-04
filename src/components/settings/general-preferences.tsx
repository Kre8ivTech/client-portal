"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, Save, Globe, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAppSettings } from "@/lib/actions/app-settings";
import { updateUserTimezone } from "@/lib/actions/user-preferences";
import { useToast } from "@/hooks/use-toast";

// Common timezones
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

interface GeneralPreferencesProps {
  initialTimezone?: string | null;
  userTimezone?: string | null;
  isSuperAdmin: boolean;
}

export function GeneralPreferences({ initialTimezone, userTimezone, isSuperAdmin }: GeneralPreferencesProps) {
  const [appTimezone, setAppTimezone] = useState(initialTimezone || "UTC");
  const [personalTimezone, setPersonalTimezone] = useState(userTimezone || "UTC");
  const [savingApp, setSavingApp] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const { toast } = useToast();

  const handleSaveAppTimezone = async () => {
    if (!isSuperAdmin) return;
    setSavingApp(true);
    try {
      const result = await updateAppSettings({ timezone: appTimezone });
      if (result.success) {
        toast({ title: "Success", description: "Global timezone updated successfully" });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingApp(false);
    }
  };

  const handleSavePersonalTimezone = async () => {
    setSavingPersonal(true);
    try {
      const result = await updateUserTimezone(personalTimezone);
      if (result.success) {
        toast({ title: "Success", description: "Your timezone preference has been updated" });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingPersonal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Personal Timezone - Available to all users */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="text-primary w-5 h-5" />
            Your Timezone
          </CardTitle>
          <CardDescription>Set your personal timezone for displaying dates and times.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="personal-timezone">Personal Timezone</Label>
            <Select value={personalTimezone} onValueChange={setPersonalTimezone} disabled={savingPersonal}>
              <SelectTrigger id="personal-timezone" className="w-full md:w-[300px]">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Times throughout the portal will be displayed in this timezone.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePersonalTimezone} disabled={savingPersonal}>
              {savingPersonal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Timezone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Global App Timezone - Super Admin only */}
      {isSuperAdmin && (
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="text-primary w-5 h-5" />
              Global Application Timezone
            </CardTitle>
            <CardDescription>Default timezone for system operations and new users.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="app-timezone">Default System Timezone</Label>
              <Select value={appTimezone} onValueChange={setAppTimezone} disabled={savingApp}>
                <SelectTrigger id="app-timezone" className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                This timezone is used for automated tasks, cron jobs, and as the default for new users.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveAppTimezone} disabled={savingApp}>
                {savingApp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Global Timezone
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
