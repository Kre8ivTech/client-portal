'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatar } from '@/lib/actions/profile'
import { Camera, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  fallbackChar: string
}

export function AvatarUpload({ userId, currentAvatarUrl, fallbackChar }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      
      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile
      await updateAvatar(publicUrl)
      setAvatarUrl(publicUrl)
      toast.success('Avatar updated successfully')
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast.error(error.message || 'Error uploading avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative h-28 w-28 rounded-full bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center text-3xl font-bold text-slate-300 overflow-hidden">
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Avatar"
            fill
            className="rounded-full object-cover"
            sizes="112px"
          />
        ) : (
          <span className="text-4xl text-slate-400 font-bold">{fallbackChar}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        title="Upload new avatar"
      >
        <Camera size={16} />
        <span className="sr-only">Upload new avatar</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        disabled={uploading}
        aria-label="Upload avatar image"
        title="Upload avatar image"
      />
    </div>
  )
}
