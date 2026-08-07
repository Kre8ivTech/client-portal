import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WhiteLabelSetupGuide } from '@/components/settings/WhiteLabelSetupGuide'

describe('WhiteLabelSetupGuide', () => {
  it('shows the ordered setup instructions and CNAME target', () => {
    render(
      <WhiteLabelSetupGuide
        organization={{ branding_config: null, custom_domain: null }}
        cnameTarget="clients.kre8ivtech.com"
      />,
    )

    expect(screen.getByText('White-label launch checklist')).toBeInTheDocument()
    expect(screen.getByText('Create your portal identity')).toBeInTheDocument()
    expect(screen.getByText('Connect your custom domain')).toBeInTheDocument()
    expect(screen.getByText('Verify and launch')).toBeInTheDocument()
    expect(screen.getByText('clients.kre8ivtech.com')).toBeInTheDocument()
    expect(screen.getByText('Optional: send email from your brand')).toBeInTheDocument()
    expect(screen.getByText('0 of 3 ready')).toBeInTheDocument()
  })

  it('derives completion from saved branding and domain settings', () => {
    render(
      <WhiteLabelSetupGuide
        organization={{
          branding_config: {
            app_name: 'Acme Portal',
            logo_url: 'https://example.com/logo.svg',
            primary_color: '#155eef',
          },
          custom_domain: 'portal.acme.com',
          custom_domain_verified: true,
        }}
        cnameTarget="clients.kre8ivtech.com"
      />,
    )

    expect(screen.getByText('3 of 3 ready')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getAllByText('Complete')).toHaveLength(3)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('requires the core identity fields before marking branding complete', () => {
    render(
      <WhiteLabelSetupGuide
        organization={{
          branding_config: { app_name: 'Acme Portal', primary_color: '#155eef' },
          custom_domain: 'portal.acme.com',
          custom_domain_verified: false,
        }}
        cnameTarget="clients.kre8ivtech.com"
      />,
    )

    expect(screen.getByText('1 of 3 ready')).toBeInTheDocument()
    expect(screen.getAllByText('Next step')).toHaveLength(2)
  })
})
