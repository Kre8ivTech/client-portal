'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Save, Shield, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Permission {
  id: string
  name: string
  label: string
  description: string | null
  category: string
  is_system: boolean
  is_active: boolean
}

interface PermissionsManagementProps {
  permissions: Permission[]
  initialRolePermissions: Record<string, string[]>
}

const ROLES = [
  { value: 'staff', label: 'Staff', description: 'Internal team members' },
  { value: 'partner', label: 'Partner', description: 'White-label agency owners' },
  { value: 'partner_staff', label: 'Partner Staff', description: 'Agency team members' },
  { value: 'client', label: 'Client', description: 'End customers' },
]

export function PermissionsManagement({
  permissions,
  initialRolePermissions,
}: PermissionsManagementProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState('staff')
  const [rolePermissions, setRolePermissions] = useState(initialRolePermissions)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = []
      }
      acc[perm.category].push(perm)
      return acc
    }, {} as Record<string, Permission[]>)
  }, [permissions])

  const categories = Object.keys(permissionsByCategory).sort()

  // Filter permissions by search
  const filteredPermissions = useMemo(() => {
    if (!searchTerm) return permissions
    const term = searchTerm.toLowerCase()
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.label.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
    )
  }, [permissions, searchTerm])

  const togglePermission = (permissionId: string) => {
    setRolePermissions((prev) => {
      const current = prev[selectedRole] || []
      const hasPermission = current.includes(permissionId)

      const updated = hasPermission
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]

      setHasChanges(true)
      return { ...prev, [selectedRole]: updated }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          permission_ids: rolePermissions[selectedRole] || [],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update permissions')
      }

      toast.success(`Permissions updated for ${selectedRole}`)
      setHasChanges(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectAll = () => {
    setRolePermissions((prev) => ({
      ...prev,
      [selectedRole]: permissions.map((p) => p.id),
    }))
    setHasChanges(true)
  }

  const handleClearAll = () => {
    setRolePermissions((prev) => ({
      ...prev,
      [selectedRole]: [],
    }))
    setHasChanges(true)
  }

  const currentRolePerms = rolePermissions[selectedRole] || []
  const selectedCount = currentRolePerms.length
  const totalCount = permissions.length

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Super admins always have all permissions. 
          Changes here affect staff, partners, and clients.
        </AlertDescription>
      </Alert>

      {/* Role Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Role to Configure</CardTitle>
          <CardDescription>
            Choose which role's permissions you want to manage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`p-4 border rounded-lg text-left transition-all ${
                  selectedRole === role.value
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <div className="font-semibold">{role.label}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {role.description}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {(rolePermissions[role.value] || []).length} permissions
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="capitalize">
                {selectedRole.replace('_', ' ')} Permissions
              </CardTitle>
              <CardDescription>
                {selectedCount} of {totalCount} permissions granted
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Unsaved Changes
                </Badge>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Actions */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleSelectAll} size="sm">
              Select All
            </Button>
            <Button variant="outline" onClick={handleClearAll} size="sm">
              Clear All
            </Button>
          </div>

          {/* Permissions by Category */}
          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {permissionsByCategory[category].filter((p) =>
                      currentRolePerms.includes(p.id)
                    ).length}
                    /{permissionsByCategory[category].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => {
              const categoryPerms = searchTerm
                ? permissionsByCategory[category].filter((p) =>
                    filteredPermissions.some((fp) => fp.id === p.id)
                  )
                : permissionsByCategory[category]

              return (
                <TabsContent key={category} value={category} className="mt-6">
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Permission</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center w-32">Granted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryPerms.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              {searchTerm ? 'No permissions match your search' : 'No permissions in this category'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          categoryPerms.map((permission) => {
                            const isGranted = currentRolePerms.includes(permission.id)
                            return (
                              <TableRow key={permission.id}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{permission.label}</div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                      {permission.name}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {permission.description || 'No description'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Switch
                                      checked={isGranted}
                                      onCheckedChange={() => togglePermission(permission.id)}
                                    />
                                    {isGranted ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Permission Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {ROLES.map((role) => {
              const count = (rolePermissions[role.value] || []).length
              const percentage = Math.round((count / totalCount) * 100)
              return (
                <div
                  key={role.value}
                  className="p-4 border rounded-lg bg-muted/30"
                >
                  <div className="font-semibold capitalize mb-1">
                    {role.label}
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {percentage}% of all permissions
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
