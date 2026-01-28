import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Settings, Globe, Palette, ShieldCheck, Mail } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user?.id)
    .single()

  const organization = profile?.organizations as any

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4">Settings</h2>
        <p className="text-slate-500 mt-2">Manage your organization and portal-wide configurations.</p>
      </div>

      <div className="grid gap-8">
        {/* Organization Branding Section */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900">
              <Palette className="text-primary w-5 h-5" />
              Portal Branding
            </CardTitle>
            <CardDescription>Customize the look and feel of your portal for clients.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">Organization Name</Label>
                  <Input defaultValue={organization?.name || ''} className="bg-white border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input defaultValue="#3B82F6" className="bg-white border-slate-200" />
                    <div className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-primary" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-slate-700">Logo</Label>
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                  <Globe size={24} className="mb-2 opacity-20" />
                  <p className="text-xs">Uploal SVG, PNG or JPG</p>
                  <Button variant="outline" size="sm" className="mt-3">Upload Image</Button>
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Button>Update Branding</Button>
            </div>
          </CardContent>
        </Card>

        {/* Domain & Network Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="text-primary w-5 h-5" />
              Domain & URL
            </CardTitle>
            <CardDescription>Setup custom domains and subdomains for your white-labeled portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-800">Current Portal URL</p>
                  <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded">https://{organization?.slug || 'my-portal'}.ktportal.app</code>
                </div>
                <div className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-100">Active</div>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Label className="text-slate-700">Custom Domain</Label>
              <div className="flex gap-2">
                <Input placeholder="portal.yourdomain.com" className="bg-white border-slate-200" />
                <Button variant="outline">Connect</Button>
              </div>
              <p className="text-[10px] text-slate-500">Requires CNAME record pointing to our edge network infrastructure.</p>
            </div>
          </CardContent>
        </Card>

        {/* Security / System Section */}
        <Card className="border-slate-200 shadow-sm opacity-60 grayscale-[0.5]">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="text-primary w-5 h-5" />
                  Advanced Security
                </CardTitle>
                <CardDescription>2FA, IP Whitelisting, and SSO integration.</CardDescription>
              </div>
              <div className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-100">Enterprise</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 grayscale text-slate-400">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="space-y-1">
                <p className="text-sm font-medium">Single Sign-On (SAML/OpenID)</p>
                <p className="text-xs">Connect your corporate identity provider.</p>
              </div>
              <Button size="sm" variant="outline" disabled>Configure</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
