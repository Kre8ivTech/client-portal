# Permissions System Guide

## Overview

KT-Portal implements a comprehensive, granular permission system that allows super admins to control exactly what each role can do. The system supports:

- **Role-based permissions** - Default permissions for each role
- **User-specific overrides** - Grant or deny permissions for individual users
- **Super admin privileges** - Super admins always have all permissions
- **Staff global access** - Staff members have access to all organizations

## Permission Structure

### Permission Format

Permissions follow the format: `{module}.{action}`

Examples:
- `tickets.create` - Can create tickets
- `invoices.delete` - Can delete invoices
- `users.permissions` - Can manage user permissions

### Available Modules

- **tickets** - Support ticket management
- **invoices** - Invoice and payment management
- **contracts** - Contract and proposal management
- **users** - User account management
- **organizations** - Organization/tenant management
- **settings** - System and portal settings
- **reports** - Analytics and reporting
- **services** - Service request management
- **messages** - Messaging and chat
- **audit** - Audit log access

### Default Role Permissions

**Super Admin** - All permissions (cannot be modified)

**Staff** (Account Managers/Project Managers)
- Full access to tickets, invoices, contracts
- Can view and create users
- Can view organizations (all)
- Can view and export reports
- Can approve service requests
- Can send messages
- Full CRUD on tickets, invoices, contracts, services

**Partner** (White-label Agency Owners)
- Can create and view tickets
- Can view invoices (read-only)
- Can sign contracts
- Can create and update users in their org
- Can view and update their own organization
- Can manage branding settings
- Can create service requests
- Can send messages

**Partner Staff** (Agency Team Members)
- Can create and view tickets
- Can view invoices (read-only)
- Can view contracts
- Can create service requests
- Can send messages
- Limited user management

**Client** (End Customers)
- Can create and view tickets
- Can view invoices
- Can view and sign contracts
- Can create service requests
- Can send messages
- Basic settings access

## Using Permissions in Code

### Server-Side (API Routes, Server Components)

```typescript
import { hasPermission, requirePermission, PERMISSIONS } from '@/lib/permissions'

// In an API route
export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  
  // Option 1: Check permission
  const canCreate = await hasPermission(user.id, PERMISSIONS.TICKETS_CREATE)
  if (!canCreate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Option 2: Require permission (throws error)
  await requirePermission(user.id, PERMISSIONS.INVOICES_DELETE)
  
  // Continue with logic...
}

// In a Server Component
export default async function Page() {
  const { data: { user } } = await supabase.auth.getUser()
  const canViewReports = await hasPermission(user.id, PERMISSIONS.REPORTS_VIEW)
  
  if (!canViewReports) {
    redirect('/dashboard')
  }
  
  // Render component...
}
```

### Client-Side (Client Components)

```typescript
'use client'

import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'

export function MyComponent({ userId }: { userId: string }) {
  const { hasPermission, isLoading } = useHasPermission(userId, PERMISSIONS.USERS_DELETE)
  
  if (isLoading) return <LoadingSpinner />
  
  return (
    <div>
      {hasPermission && (
        <Button onClick={handleDelete}>Delete User</Button>
      )}
    </div>
  )
}
```

### Using Permission Gates

```typescript
'use client'

import { PermissionGate, PermissionGateAny } from '@/components/auth/permission-gate'
import { PERMISSIONS } from '@/lib/permissions'

export function MyComponent({ userId }: { userId: string }) {
  return (
    <div>
      {/* Only render if user has permission */}
      <PermissionGate userId={userId} permission={PERMISSIONS.INVOICES_CREATE}>
        <CreateInvoiceButton />
      </PermissionGate>
      
      {/* Render if user has ANY of the permissions */}
      <PermissionGateAny 
        userId={userId} 
        permissions={[PERMISSIONS.USERS_VIEW, PERMISSIONS.ORGANIZATIONS_VIEW]}
      >
        <AdminPanel />
      </PermissionGateAny>
      
      {/* Show alert if permission denied */}
      <PermissionGate 
        userId={userId} 
        permission={PERMISSIONS.AUDIT_VIEW}
        showAlert={true}
      >
        <AuditLogViewer />
      </PermissionGate>
    </div>
  )
}
```

## Managing Permissions (Admin UI)

### Role-Based Permissions

1. Navigate to **Admin** → **Permissions**
2. Select the role you want to configure (Staff, Partner, Partner Staff, or Client)
3. Toggle permissions on/off using the switches
4. Use tabs to navigate between permission categories
5. Use "Select All" or "Clear All" for bulk changes
6. Click "Save Changes" when done

**Features:**
- Search permissions by name or description
- Category tabs (tickets, invoices, contracts, etc.)
- Permission count summary by role
- Visual indicators for granted permissions

### User-Specific Overrides

1. Navigate to **Admin** → **User Management**
2. Click the **⋮** menu next to a user
3. Select "Manage Permissions"
4. You'll see:
   - **Blue badges** = Permissions from role
   - **Green badges** = Additional grants for this user
   - **Red badges** = Explicitly denied permissions

**Actions:**
- **Grant** - Give user a permission they don't have via role
- **Deny** - Revoke a permission the user has via role
- **Remove Grant/Deny** - Return to role default

**Use Cases:**
- Give a specific client access to reports
- Temporarily remove invoice access from a staff member
- Grant a partner staff member elevated permissions

## Permission Hierarchy

The system checks permissions in this order:

1. **Super Admin** → Always returns TRUE (bypasses all checks)
2. **Explicit User Deny** → Returns FALSE if user has explicit deny
3. **Explicit User Grant** → Returns TRUE if user has explicit grant
4. **Role Permission** → Returns TRUE if role has permission
5. **Default** → Returns FALSE

## Best Practices

### When to Use Role Permissions
- Setting baseline permissions for all users in a role
- Establishing standard access patterns
- Most common use case

### When to Use User Overrides
- Temporary elevated access for a specific user
- Removing specific permissions from a user temporarily
- Giving a client special access to a normally restricted feature
- Testing new permission configurations before rolling out to role

### Security Considerations

1. **Least Privilege** - Start with minimal permissions and add as needed
2. **Audit Changes** - All permission changes are logged (coming soon)
3. **Regular Review** - Periodically review permission assignments
4. **Super Admin Access** - Carefully manage who has super_admin role

## Adding Custom Permissions

Super admins can add custom permissions via the API:

```bash
POST /api/admin/permissions
{
  "name": "projects.archive",
  "label": "Archive Projects",
  "description": "Can archive completed projects",
  "category": "projects"
}
```

Or via the Supabase dashboard:

```sql
INSERT INTO public.permissions (name, label, description, category, is_system)
VALUES ('projects.archive', 'Archive Projects', 'Can archive projects', 'projects', FALSE);
```

Then assign to roles via the Permissions Management UI.

## Permission Categories Reference

### Tickets (tickets.*)
- `view` - View tickets
- `create` - Create new tickets
- `update` - Edit ticket details
- `delete` - Delete tickets
- `assign` - Assign tickets to staff
- `close` - Close/resolve tickets
- `comment` - Add comments to tickets

### Invoices (invoices.*)
- `view` - View invoices
- `create` - Create new invoices
- `update` - Edit invoice details
- `delete` - Delete invoices
- `send` - Send invoices to clients
- `payment` - Record payments

### Contracts (contracts.*)
- `view` - View contracts
- `create` - Create new contracts
- `update` - Edit contract details
- `delete` - Delete contracts
- `send` - Send contracts for signature
- `sign` - Sign contracts

### Users (users.*)
- `view` - View user list
- `create` - Create new users
- `update` - Edit user details
- `delete` - Delete users
- `permissions` - Manage user permissions

### Organizations (organizations.*)
- `view` - View organizations
- `create` - Create new organizations
- `update` - Edit organization details
- `delete` - Delete organizations

### Settings (settings.*)
- `view` - View settings
- `update` - Update system settings
- `branding` - Manage portal branding
- `integrations` - Manage third-party integrations

### Reports (reports.*)
- `view` - View reports and analytics
- `export` - Export reports

### Services (services.*)
- `view` - View service requests
- `create` - Create service requests
- `update` - Edit service details
- `approve` - Approve service requests

### Messages (messages.*)
- `view` - View messages
- `send` - Send messages
- `delete` - Delete messages

### Audit (audit.*)
- `view` - View audit logs

## Troubleshooting

### Permission Not Working

1. **Check role assignment** - Verify user has correct role in User Management
2. **Check permission exists** - View all permissions in Permissions Management
3. **Check user overrides** - Look for explicit denies in user permissions
4. **Clear cache** - Permissions are cached; refresh may be needed
5. **Check RLS policies** - Database policies work alongside permissions

### Common Issues

**User can't see feature despite having permission:**
- Check if component uses old role-based check instead of permission check
- Verify permission name matches exactly (case-sensitive)
- Check browser console for permission check errors

**Permission changes not taking effect:**
- Hard refresh the browser (Ctrl+F5)
- Clear React Query cache
- Check network tab to ensure API call succeeded

## Migration from Role-Based to Permissions

If you have existing role checks like:

```typescript
// OLD
if (userRole === 'super_admin' || userRole === 'staff') {
  // Show feature
}

// NEW
const { hasPermission } = useHasPermission(userId, PERMISSIONS.FEATURE_NAME)
if (hasPermission) {
  // Show feature
}
```

Or using Permission Gates:

```typescript
// OLD
{userRole === 'super_admin' && <AdminPanel />}

// NEW
<PermissionGate userId={userId} permission={PERMISSIONS.ADMIN_FEATURE}>
  <AdminPanel />
</PermissionGate>
```

## Future Enhancements

- [ ] Permission templates for common role configurations
- [ ] Bulk permission assignment UI
- [ ] Permission audit history
- [ ] Permission dependency checking (e.g., delete requires update)
- [ ] Permission groups/bundles
- [ ] Time-limited permission grants

---

**Last Updated:** February 2, 2026
