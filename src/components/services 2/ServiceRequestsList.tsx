'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Loader2 } from 'lucide-react'
import { ServiceRequestAdminCard } from './ServiceRequestAdminCard'
import type { Database } from '@/types/database'

type ServiceRequest = Database['public']['Tables']['service_requests']['Row'] & {
  service?: {
    id: string
    name: string
    description: string | null
    category: string | null
    base_rate: number | null
    rate_type: string
  } | null
  requester?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ServiceRequestsListProps {
  initialRequests: ServiceRequest[]
}

export function ServiceRequestsList({ initialRequests }: ServiceRequestsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-service-requests'],
    queryFn: async () => {
      const response = await fetch('/api/service-requests')
      if (!response.ok) throw new Error('Failed to fetch service requests')
      const result = await response.json()
      return result.data as ServiceRequest[]
    },
    initialData: initialRequests,
  })

  // Filter requests
  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      request.service?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requester?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requester?.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'pending' && request.status === 'pending') ||
      (activeTab === 'approved' && request.status === 'approved') ||
      (activeTab === 'rejected' && request.status === 'rejected')

    return matchesSearch && matchesTab
  })

  const getPendingCount = () => {
    return requests?.filter((r) => r.status === 'pending').length || 0
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by service, client name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {getPendingCount() > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {getPendingCount()}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Requests Grid */}
      {filteredRequests && filteredRequests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((request) => (
            <ServiceRequestAdminCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No service requests found</p>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search terms
            </p>
          )}
        </div>
      )}
    </div>
  )
}
