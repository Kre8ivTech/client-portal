'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2, Loader2, Save, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

type ClientAdminControlsProps = {
  clientId: string
  clientName: string
  initialType: 'client' | 'partner'
  status: string | null
}

type ApiPayload = {
  error?: string
}

export function ClientAdminControls({
  clientId,
  clientName,
  initialType,
  status,
}: ClientAdminControlsProps) {
  const router = useRouter()
  const [clientType, setClientType] = useState(initialType)
  const [savedType, setSavedType] = useState(initialType)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const endpoint = '/api/admin/clients/' + encodeURIComponent(clientId)

  async function saveClientType() {
    setIsSaving(true)
    setRoleError(null)

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: clientType }),
      })
      const payload = (await response.json().catch(() => null)) as ApiPayload | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update client role')
      }

      setSavedType(clientType)
      toast({
        title: 'Client role updated',
        description:
          clientType === 'partner'
            ? `${clientName} is now a white-label partner.`
            : `${clientName} is now a standard client.`,
      })
      router.refresh()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update client role'
      setRoleError(message)
      toast({ title: 'Client role was not updated', description: message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteClient() {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const payload = (await response.json().catch(() => null)) as ApiPayload | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete client')
      }

      setDeleteOpen(false)
      toast({ title: `${clientName} deleted` })
      router.push('/dashboard/clients')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete client'
      setDeleteError(message)
      toast({ title: 'Client was not deleted', description: message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe2 className="h-5 w-5 text-amber-700" aria-hidden="true" />
          Admin controls
        </CardTitle>
        <CardDescription>
          Set the client’s portal role or remove it from active client management.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="client-role">Client role</Label>
            <Select value={clientType} onValueChange={(value: 'client' | 'partner') => setClientType(value)}>
              <SelectTrigger id="client-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Standard client (no white-label)</SelectItem>
                <SelectItem value="partner">White-label partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => void saveClientType()}
            disabled={isSaving || clientType === savedType}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {isSaving ? 'Saving...' : 'Save role'}
          </Button>
        </div>

        <div className="border-t border-amber-200 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">Delete client</p>
              <p className="text-sm text-slate-600">
                Deactivate this client while preserving its historical records.
              </p>
            </div>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={status === 'inactive'}>
                  <Trash2 aria-hidden="true" />
                  {status === 'inactive' ? 'Client deleted' : 'Delete client'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {clientName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deactivates the client and removes it from active client management. Its
                    invoices, contracts, tickets, files, and audit history are preserved. This
                    action cannot be undone from the portal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteError}
                  </p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.preventDefault()
                      void deleteClient()
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Deleting...
                      </>
                    ) : (
                      'Delete client'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {roleError && (
          <p role="alert" className="text-sm text-destructive">
            {roleError}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
