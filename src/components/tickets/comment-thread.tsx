'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  MessageSquare,
  Send,
  Loader2,
  Lock,
  Paperclip,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { cn, formatDateTime, formatDistanceToNow } from '@/lib/utils'
import type { TicketCommentWithUser } from '@/types/tickets'

interface CommentThreadProps {
  comments: TicketCommentWithUser[]
  ticketId: string
  onAddComment: (content: string, isInternal: boolean) => Promise<void>
  onEditComment?: (commentId: string, content: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
  isStaff?: boolean
  currentUserId?: string
  isLoading?: boolean
  className?: string
}

export function CommentThread({
  comments,
  ticketId,
  onAddComment,
  onEditComment,
  onDeleteComment,
  isStaff = false,
  currentUserId,
  isLoading = false,
  className,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(newComment.trim(), isInternal)
      setNewComment('')
      setIsInternal(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (commentId: string) => {
    if (!editContent.trim() || !onEditComment) return

    setIsSubmitting(true)
    try {
      await onEditComment(commentId, editContent.trim())
      setEditingId(null)
      setEditContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditing = (comment: TicketCommentWithUser) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare size={18} />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment list */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to add a comment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isOwn={comment.user_id === currentUserId}
                isStaff={isStaff}
                isEditing={editingId === comment.id}
                editContent={editContent}
                onEditContentChange={setEditContent}
                onStartEdit={() => startEditing(comment)}
                onCancelEdit={() => { setEditingId(null); setEditContent(''); }}
                onSaveEdit={() => handleEditSubmit(comment.id)}
                onDelete={onDeleteComment ? () => onDeleteComment(comment.id) : undefined}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        )}

        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            disabled={isSubmitting || isLoading}
            className="resize-none"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Internal note toggle - staff only */}
              {isStaff && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-slate-300"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-slate-600 flex items-center gap-1">
                    <Lock size={14} />
                    Internal note
                  </span>
                </label>
              )}
              
              {/* Attachment button placeholder */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-500"
                disabled
              >
                <Paperclip size={16} className="mr-1" />
                Attach
              </Button>
            </div>

            <Button
              type="submit"
              disabled={!newComment.trim() || isSubmitting || isLoading}
              size="sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-1" />
                  Send
                </>
              )}
            </Button>
          </div>

          {isInternal && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded">
              <AlertCircle size={14} />
              Internal notes are only visible to staff members
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

// Individual comment item
interface CommentItemProps {
  comment: TicketCommentWithUser
  isOwn: boolean
  isStaff: boolean
  isEditing: boolean
  editContent: string
  onEditContentChange: (content: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete?: () => void
  isSubmitting: boolean
}

function CommentItem({
  comment,
  isOwn,
  isStaff,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSubmitting,
}: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  const userName = comment.user?.name || comment.user?.email || 'Unknown'
  const userRole = comment.user?.role
  const isStaffComment = userRole === 'super_admin' || userRole === 'staff'

  return (
    <div
      className={cn(
        'p-4 rounded-lg',
        comment.is_internal 
          ? 'bg-amber-50 border border-amber-200' 
          : isStaffComment 
            ? 'bg-blue-50 border border-blue-100'
            : 'bg-slate-50 border border-slate-100'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div 
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium text-white',
              isStaffComment ? 'bg-blue-500' : 'bg-slate-400'
            )}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{userName}</span>
              {isStaffComment && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  Staff
                </span>
              )}
              {comment.is_internal && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock size={10} />
                  Internal
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {formatDistanceToNow(comment.created_at)}
              {comment.updated_at !== comment.created_at && ' (edited)'}
            </p>
          </div>
        </div>

        {/* Actions menu */}
        {(isOwn || isStaff) && !isEditing && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <MoreHorizontal size={16} className="text-slate-400" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border rounded shadow-lg py-1 z-10">
                <button
                  onClick={() => { onStartEdit(); setShowMenu(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit size={14} />
                  Edit
                </button>
                {onDelete && (
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSaveEdit}
              disabled={!editContent.trim() || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {comment.content}
        </p>
      )}

      {/* Attachments */}
      {comment.attachments && comment.attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">Attachments:</p>
          <div className="flex flex-wrap gap-2">
            {comment.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-white px-2 py-1 rounded border"
              >
                <Paperclip size={12} />
                {attachment.filename}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
