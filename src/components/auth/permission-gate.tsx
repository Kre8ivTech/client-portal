'use client'

import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from '@/hooks/use-permissions'
import { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldX } from 'lucide-react'

interface PermissionGateProps {
  userId: string
  children: ReactNode
  fallback?: ReactNode
  showAlert?: boolean
}

/**
 * Component that renders children only if user has the specified permission
 */
export function PermissionGate({
  userId,
  permission,
  children,
  fallback,
  showAlert = false,
}: PermissionGateProps & { permission: string }) {
  const { hasPermission, isLoading } = useHasPermission(userId, permission)

  if (isLoading) {
    return null
  }

  if (!hasPermission) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Component that renders children only if user has ANY of the specified permissions
 */
export function PermissionGateAny({
  userId,
  permissions,
  children,
  fallback,
  showAlert = false,
}: PermissionGateProps & { permissions: string[] }) {
  const { hasAnyPermission, isLoading } = useHasAnyPermission(userId, permissions)

  if (isLoading) {
    return null
  }

  if (!hasAnyPermission) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Component that renders children only if user has ALL of the specified permissions
 */
export function PermissionGateAll({
  userId,
  permissions,
  children,
  fallback,
  showAlert = false,
}: PermissionGateProps & { permissions: string[] }) {
  const { hasAllPermissions, isLoading } = useHasAllPermissions(userId, permissions)

  if (isLoading) {
    return null
  }

  if (!hasAllPermissions) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>
            You don't have all required permissions to access this feature.
          </AlertDescription>
        </Alert>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}
