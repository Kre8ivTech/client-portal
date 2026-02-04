'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Settings, Loader2, Save } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateAppSettings } from '@/lib/actions/app-settings'
import { useToast } from '@/hooks/use-toast'

// Common timezones
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
]

interface GeneralPreferencesProps {
  initialTimezone?: string | null
  isSuperAdmin: boolean
}

export function GeneralPreferences({ initialTimezone, isSuperAdmin }: GeneralPreferencesProps) {
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!isSuperAdmin) return
    setSaving(true)
    try {
      const result = await updateAppSettings({ timezone })
      if (result.success) {
        toast({ title: 'Success', description: 'Preferences updated successfully' })
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Settings className="text-primary w-5 h-5" />
          General Preferences
        </CardTitle>
        <CardDescription>
          Configure global application settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="timezone">Default Timezone</Label>
          <Select 
            value={timezone} 
            onValueChange={setTimezone}
            disabled={!isSuperAdmin || saving}
          >
            <SelectTrigger id="timezone" className="w-full md:w-[300px]">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This timezone is used as the default for system operations and new users.
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        )}
        
        {!isSuperAdmin && (
           <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
             Only Super Admins can change global preferences.
           </p>
        )}
      </CardContent>
    </Card>
  )
}
