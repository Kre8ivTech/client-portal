'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ClientList } from '@/components/clients'
import { Plus } from 'lucide-react'
import type { OrganizationWithRelations } from '@/types/organizations'

// Mock data for development
const MOCK_CLIENTS: OrganizationWithRelations[] = [
  {
    id: 'client-1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    type: 'client',
    parent_org_id: null,
    status: 'active',
    branding_config: {},
    custom_domain: null,
    custom_domain_verified: false,
    custom_domain_verified_at: null,
    settings: {},
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 5,
    active_tickets_count: 3,
    pending_invoices_count: 1,
  },
  {
    id: 'client-2',
    name: 'TechStartup Inc',
    slug: 'techstartup',
    type: 'client',
    parent_org_id: null,
    status: 'active',
    branding_config: {},
    custom_domain: 'portal.techstartup.io',
    custom_domain_verified: true,
    custom_domain_verified_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    settings: {},
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 12,
    active_tickets_count: 7,
    pending_invoices_count: 0,
  },
  {
    id: 'client-3',
    name: 'Local Bakery Shop',
    slug: 'local-bakery',
    type: 'client',
    parent_org_id: null,
    status: 'active',
    branding_config: {},
    custom_domain: null,
    custom_domain_verified: false,
    custom_domain_verified_at: null,
    settings: {},
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 2,
    active_tickets_count: 1,
    pending_invoices_count: 2,
  },
  {
    id: 'client-4',
    name: 'Global Enterprises Ltd',
    slug: 'global-enterprises',
    type: 'client',
    parent_org_id: null,
    status: 'inactive',
    branding_config: {},
    custom_domain: null,
    custom_domain_verified: false,
    custom_domain_verified_at: null,
    settings: {},
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 3,
    active_tickets_count: 0,
    pending_invoices_count: 0,
  },
  {
    id: 'client-5',
    name: 'Creative Agency Co',
    slug: 'creative-agency',
    type: 'client',
    parent_org_id: null,
    status: 'active',
    branding_config: {
      primary_color: '#FF5722',
    },
    custom_domain: 'support.creativeagency.com',
    custom_domain_verified: true,
    custom_domain_verified_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    settings: {},
    created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 8,
    active_tickets_count: 4,
    pending_invoices_count: 1,
  },
  {
    id: 'partner-1',
    name: 'Digital Solutions Agency',
    slug: 'digital-solutions',
    type: 'partner',
    parent_org_id: null,
    status: 'active',
    branding_config: {
      logo_url: 'https://example.com/logo.png',
      primary_color: '#2563EB',
    },
    custom_domain: 'clients.digitalsolutions.com',
    custom_domain_verified: true,
    custom_domain_verified_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    settings: {},
    created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    members_count: 15,
    active_tickets_count: 12,
    pending_invoices_count: 3,
    child_organizations: [
      {
        id: 'partner-client-1',
        name: 'Partner Client A',
        slug: 'partner-client-a',
        type: 'client',
        parent_org_id: 'partner-1',
        status: 'active',
        branding_config: {},
        custom_domain: null,
        custom_domain_verified: false,
        custom_domain_verified_at: null,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ],
  },
]

export default function ClientsPage() {
  const [clients] = useState<OrganizationWithRelations[]>(MOCK_CLIENTS)
  const router = useRouter()

  const handleClientClick = (client: OrganizationWithRelations) => {
    // TODO: Navigate to client detail page
    alert(`Client ${client.name} clicked - detail page coming soon`)
  }

  const handleCreateClick = () => {
    // TODO: Open create client form/modal
    alert('Add client - coming soon')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Clients
          </h2>
          <p className="text-slate-500 mt-1 hidden md:block">
            Manage client organizations and partnerships
          </p>
        </div>
        
        <Button onClick={handleCreateClick} className="gap-2 hidden md:flex">
          <Plus size={18} />
          Add Client
        </Button>
      </div>

      {/* Client list */}
      <ClientList
        clients={clients}
        onClientClick={handleClientClick}
        onCreateClick={handleCreateClick}
        showTypeFilter={true}
      />
    </div>
  )
}
