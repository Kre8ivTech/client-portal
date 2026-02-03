'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Save, CheckCircle, XCircle, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Permission {
  id: string
  name: string
  label: string
  description: string | null
  category: string
}

interface UserPermission {
  id: string
  permission_id: string
  granted: boolean
  permissions: Permission
}

interface UserPermissionsEditorProps {
  targetUser: any
  allPermissions: Permission[]
  rolePermissionIds: string[]
  initialUserPermissions: UserPermission[]
}

export function UserPermissionsEditor({
  targetUser,
  allPermissions,
  rolePermissionIds,
  initialUserPermissions,
}: UserPermissionsEditorProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track grants and denies
  const [grants, setGrants] = useState<Set<string>>(
    new Set(initialUserPermissions.filter((up) => up.granted).map((up) => up.permission_id))
  )
  const [denies, setDenies] = useState<Set<string>>(
    new Set(initialUserPermissions.filter((up) => !up.granted).map((up) => up.permission_id))
  )

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = []
      }
      acc[perm.category].push(perm)
      return acc
    }, {} as Record<string, Permission[]>)
  }, [allPermissions])

  const categories = Object.keys(permissionsByCategory).sort()

  // Filter permissions by search
  const filteredPermissions = useMemo(() => {
    if (!searchTerm) return allPermissions
    const term = searchTerm.toLowerCase()
    return allPermissions.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.label.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
    )
  }, [allPermissions, searchTerm])

  const getPermissionState = (permissionId: string) => {
    if (grants.has(permissionId)) return 'granted'
    if (denies.has(permissionId)) return 'denied'
    if (rolePermissionIds.includes(permissionId)) return 'role'
    return 'none'
  }

  const togglePermission = (permissionId: string, action: 'grant' | 'deny' | 'clear') => {
    setGrants((prev) => {
      const next = new Set(prev)
      if (action === 'grant') {
        next.add(permissionId)
      } else {
        next.delete(permissionId)
      }
      return next
    })

    setDenies((prev) => {
      const next = new Set(prev)
      if (action === 'deny') {
        next.add(permissionId)
      } else {
        next.delete(permissionId)
      }
      return next
    })

    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/admin/permissions/users/${targetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grants: Array.from(grants),
          denies: Array.from(denies),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update permissions')
      }

      toast.success('User permissions updated successfully')
      setHasChanges(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Permission Override System:</strong> Blue badges show permissions from the user's role ({targetUser.role}). 
          You can grant additional permissions or explicitly deny role permissions.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rolePermissionIds.length}</div>
            <p className="text-xs text-muted-foreground">From {targetUser.role} role</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Additional Grants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{grants.size}</div>
            <p className="text-xs text-muted-foreground">Extra permissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Explicit Denies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{denies.size}</div>
            <p className="text-xs text-muted-foreground">Revoked permissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>Manage user-specific permission overrides</CardDescription>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search permissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs by Category */}
          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category}
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
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryPerms.map((permission) => {
                          const state = getPermissionState(permission.id)
                          const hasRolePermission = rolePermissionIds.includes(permission.id)

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
                              <TableCell>
                                {state === 'granted' ? (
                                  <Badge className="gap-1 bg-green-600">
                                    <CheckCircle className="h-3 w-3" />
                                    Granted
                                  </Badge>
                                ) : state === 'denied' ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Denied
                                  </Badge>
                                ) : hasRolePermission ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Via Role
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    Not Granted
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {state === 'granted' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => togglePermission(permission.id, 'clear')}
                                    >
                                      Remove Grant
                                    </Button>
                                  ) : state === 'denied' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => togglePermission(permission.id, 'clear')}
                                    >
                                      Remove Deny
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => togglePermission(permission.id, 'grant')}
                                      >
                                        Grant
                                      </Button>
                                      {hasRolePermission && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => togglePermission(permission.id, 'deny')}
                                        >
                                          Deny
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
