'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Loader2, Save } from "lucide-react"
import { updateSecuritySettings } from "@/lib/actions/security-settings"
import { useToast } from "@/hooks/use-toast"

interface SecuritySettingsProps {
  organizationId: string
  settings?: {
    mfa_enforced?: boolean
    ip_whitelist?: string[]
    session_timeout_minutes?: number
  }
}

export function SecuritySettings({ organizationId, settings }: SecuritySettingsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [mfaEnforced, setMfaEnforced] = useState(settings?.mfa_enforced || false)
  const [ipWhitelist, setIpWhitelist] = useState(settings?.ip_whitelist?.join('\n') || '')
  const [sessionTimeout, setSessionTimeout] = useState(settings?.session_timeout_minutes || 60)

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await updateSecuritySettings(organizationId, {
        mfa_enforced: mfaEnforced,
        ip_whitelist: ipWhitelist,
        session_timeout_minutes: sessionTimeout
      })

      if (result.success) {
        toast({ title: "Success", description: "Security settings updated successfully" })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card id="security" className="border-border shadow-sm scroll-mt-20">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="text-primary w-5 h-5" />
              Advanced Security
            </CardTitle>
            <CardDescription>
              Configure access controls and security policies for your organization.
            </CardDescription>
          </div>
          <div className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-100">
            Configurable
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* MFA Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label className="text-base">Enforce Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              Require all staff members to use 2FA.
            </p>
          </div>
          <Switch 
            checked={mfaEnforced} 
            onCheckedChange={setMfaEnforced} 
          />
        </div>

        {/* Session Timeout */}
        <div className="space-y-2">
          <Label>Session Timeout (minutes)</Label>
          <div className="flex gap-2 items-center">
            <Input 
              type="number" 
              value={sessionTimeout} 
              onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 0)}
              className="max-w-[150px]"
            />
            <span className="text-sm text-muted-foreground">minutes of inactivity</span>
          </div>
        </div>

        {/* IP Whitelist */}
        <div className="space-y-2">
          <Label>IP Whitelist</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Enter one IP address per line. Leave empty to allow access from anywhere.
          </p>
          <Textarea 
            placeholder="192.168.1.1&#10;10.0.0.1"
            rows={4}
            value={ipWhitelist}
            onChange={(e) => setIpWhitelist(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Security Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
