'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ServiceCard } from './service-card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Loader2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Service = Database['public']['Tables']['services']['Row'] & {
  created_by_user?: {
    id: string
    profiles: { name: string | null } | null
  } | null
}

interface ServiceListProps {
  initialServices: Service[]
}

export function ServiceList({ initialServices }: ServiceListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const { data: services, isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const response = await fetch('/api/admin/services')
      if (!response.ok) throw new Error('Failed to fetch services')
      const result = await response.json()
      return result.data as Service[]
    },
    initialData: initialServices,
  })

  // Filter services
  const filteredServices = services?.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.category?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'active' && service.is_active) ||
      (activeTab === 'inactive' && !service.is_active)

    return matchesSearch && matchesTab
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Service Grid */}
      {filteredServices && filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-slate-500">No services found</p>
          {searchTerm && (
            <p className="text-sm text-slate-400 mt-1">
              Try adjusting your search terms
            </p>
          )}
        </div>
      )}
    </div>
  )
}
