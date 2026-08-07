import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Check, Globe2, Mail, Palette, Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type WhiteLabelSetupGuideProps = {
  organization: {
    custom_domain?: string | null
    custom_domain_verified?: boolean | null
    branding_config?: {
      app_name?: string | null
      logo_url?: string | null
      primary_color?: string | null
    } | null
  }
  cnameTarget: string
}

type SetupStep = {
  title: string
  description: string
  href: string
  action: string
  complete: boolean
  icon: typeof Palette
  detail?: ReactNode
}

export function WhiteLabelSetupGuide({
  organization,
  cnameTarget,
}: WhiteLabelSetupGuideProps) {
  const branding = organization.branding_config ?? {}
  const brandingComplete = Boolean(
    branding.app_name?.trim() && branding.logo_url?.trim() && branding.primary_color?.trim(),
  )
  const domainConnected = Boolean(organization.custom_domain?.trim())
  const domainVerified = Boolean(organization.custom_domain_verified)

  const steps: SetupStep[] = [
    {
      title: 'Create your portal identity',
      description:
        'Add a portal name, hosted logo URL, and primary brand color. You can also customize the tagline and login background.',
      href: '#white-label-branding',
      action: 'Open branding',
      complete: brandingComplete,
      icon: Palette,
    },
    {
      title: 'Connect your custom domain',
      description:
        'Choose a portal subdomain, add the CNAME record with your DNS provider, then save the domain below.',
      href: '#white-label-domain',
      action: 'Open domain setup',
      complete: domainConnected,
      icon: Globe2,
      detail: (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <code className="rounded-md bg-muted px-2 py-1 text-foreground">
            portal.yourdomain.com
          </code>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          <code className="rounded-md bg-muted px-2 py-1 text-foreground">{cnameTarget}</code>
        </div>
      ),
    },
    {
      title: 'Verify and launch',
      description:
        'After DNS has propagated, select Verify now. Once verified, open your custom domain in a private browser window and test sign-in on desktop and mobile.',
      href: '#white-label-domain',
      action: domainVerified ? 'Review launch settings' : 'Verify domain',
      complete: domainVerified,
      icon: Rocket,
    },
  ]

  const completedSteps = steps.filter((step) => step.complete).length
  const progress = Math.round((completedSteps / steps.length) * 100)

  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/30 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-xl">White-label launch checklist</CardTitle>
          <CardDescription className="max-w-2xl">
            Complete these steps to publish a branded portal on your own domain. Most setups take
            about 15 minutes, plus DNS propagation time.
          </CardDescription>
        </div>
        <Badge variant={completedSteps === steps.length ? 'success' : 'secondary'}>
          {completedSteps} of {steps.length} ready
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b px-6 py-4">
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-foreground">Setup progress</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="h-2"
            aria-label={`${completedSteps} of ${steps.length} white-label setup steps complete`}
          />
        </div>

        <ol className="divide-y">
          {steps.map((step, index) => {
            const Icon = step.icon

            return (
              <li key={step.title} className="px-6 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                      step.complete
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-border bg-background text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {step.complete ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                      <Badge variant={step.complete ? 'success' : 'outline'}>
                        {step.complete ? 'Complete' : 'Next step'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                    {step.detail}
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 sm:mt-0.5">
                    <Link href={step.href}>
                      {step.action}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Optional: send email from your brand</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add your SMTP provider after launch so portal notifications use your sender name
                and address.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
            <Link href="#white-label-email">
              Configure email
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
