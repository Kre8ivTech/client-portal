'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FolderKanban, Search, Users, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROJECT_STATUS_OPTIONS, PROJECT_PRIORITY_OPTIONS } from '@/lib/validators/project'

type ProjectMember = {
  id: string
  user_id: string
  role: string
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type ProjectOrganization = {
  id: string
  organization_id: string
  role: string
  organization: {
    id: string
    name: string
  } | null
}

type Project = {
  id: string
  project_number: number
  name: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  target_end_date: string | null
  created_at: string
  created_by: string
  organization: { id: string; name: string } | null
  project_members: ProjectMember[]
  project_organizations: ProjectOrganization[]
}

interface ProjectListProps {
  projects: Project[]
  canEdit: boolean
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default'
    case 'completed':
      return 'secondary'
    case 'on_hold':
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return ''
  }
}

export function ProjectList({ projects, canEdit }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `PRJ-${project.project_number}`.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderKanban className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">No projects yet</h3>
        <p className="text-slate-500 text-sm max-w-sm">
          {canEdit
            ? 'Create your first project to get started.'
            : 'No projects have been assigned to your organization yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PROJECT_PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
          <Search className="h-8 w-8 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No matching projects</h3>
          <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const projectManagers = project.project_members.filter(
                  (m) => m.role === 'project_manager' || m.role === 'account_manager'
                )
                const clientOrgs = project.project_organizations.filter((o) => o.role === 'client')

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FolderKanban className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="font-medium text-slate-900 hover:text-primary transition-colors block truncate"
                          >
                            {project.name}
                          </Link>
                          <p className="text-xs text-slate-500 font-mono">
                            PRJ-{project.project_number}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', getPriorityBadgeClass(project.priority))}
                      >
                        {project.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {projectManagers.length > 0 ? (
                        <div className="flex -space-x-2">
                          {projectManagers.slice(0, 3).map((member) => {
                            const name = member.user?.profiles?.name ?? member.user?.email ?? '?'
                            const initials = name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)
                            return (
                              <Avatar
                                key={member.id}
                                className="h-8 w-8 border-2 border-white"
                                title={name}
                              >
                                <AvatarImage src={member.user?.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                            )
                          })}
                          {projectManagers.length > 3 && (
                            <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-600">
                              +{projectManagers.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">
                          <Users className="h-4 w-4" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {clientOrgs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {clientOrgs.slice(0, 2).map((org) => (
                            <Badge key={org.id} variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {org.organization?.name}
                            </Badge>
                          ))}
                          {clientOrgs.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{clientOrgs.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">
                          <Building2 className="h-4 w-4" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {project.start_date ? (
                          <span>{new Date(project.start_date).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-slate-400">Not set</span>
                        )}
                        {project.target_end_date && (
                          <>
                            <span className="text-slate-400 mx-1">-</span>
                            <span>{new Date(project.target_end_date).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/projects/${project.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
