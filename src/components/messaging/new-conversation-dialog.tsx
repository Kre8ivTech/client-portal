'use client'

import { useState, useCallback } from 'react'
import { useMessageableUsers, type MessageableUser } from '@/hooks/use-messageable-users'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Search, MessageSquare, Loader2, Send, ChevronLeft, Users, User } from 'lucide-react'
import { cn } from '@/lib/cn'

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConversationCreated: (conversationId: string) => void
}

type Step = 'select-recipient' | 'compose-message'

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [step, setStep] = useState<Step>('select-recipient')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<MessageableUser | null>(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: users, isLoading } = useMessageableUsers(search)

  const handleSelectUser = useCallback((user: MessageableUser) => {
    setSelectedUser(user)
    setStep('compose-message')
    setError(null)
  }, [])

  const handleBack = useCallback(() => {
    setStep('select-recipient')
    setError(null)
  }, [])

  const handleSend = useCallback(async () => {
    if (!selectedUser || !message.trim()) return

    setIsSending(true)
    setError(null)

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [selectedUser.id],
          initialMessage: message.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create conversation')
      }

      onConversationCreated(data.data.id)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setIsSending(false)
    }
  }, [selectedUser, message, onConversationCreated])

  const handleClose = useCallback(() => {
    setStep('select-recipient')
    setSearch('')
    setSelectedUser(null)
    setMessage('')
    setError(null)
    onOpenChange(false)
  }, [onOpenChange])

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive'
      case 'staff':
        return 'default'
      case 'partner':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getPresenceColor = (status: string | null) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      case 'dnd':
        return 'bg-red-500'
      default:
        return 'bg-slate-300'
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'compose-message' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <MessageSquare className="h-5 w-5" />
            {step === 'select-recipient' ? 'New Message' : 'Send Message'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-recipient'
              ? 'Search and select a person to message'
              : `Start a conversation with ${selectedUser?.profiles?.name || selectedUser?.email}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'select-recipient' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : users && users.length > 0 ? (
                <div className="space-y-1">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all duration-200",
                        "flex items-center gap-3 group",
                        "hover:bg-slate-100"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={user.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="bg-blue-500 text-white font-medium">
                            {(user.profiles?.name || user.email)?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full",
                            getPresenceColor(user.profiles?.presence_status || null)
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-slate-900 truncate">
                            {user.profiles?.name || user.email?.split('@')[0]}
                          </p>
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        {user.organization?.name && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {user.organization.name}
                          </p>
                        )}
                      </div>

                      <MessageSquare className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                  <Users className="h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    {search ? 'No users found' : 'Start typing to search users'}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected user preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Avatar className="h-10 w-10 border shadow-sm">
                <AvatarImage src={selectedUser?.profiles?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-500 text-white font-medium">
                  {(selectedUser?.profiles?.name || selectedUser?.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900">
                  {selectedUser?.profiles?.name || selectedUser?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-500">{selectedUser?.email}</p>
              </div>
            </div>

            {/* Message input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Write your message..."
                className="min-h-[120px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>

            {/* Send button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isSending}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
                className="gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
