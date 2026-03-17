'use client'

import { useMemo } from 'react'
import { sanitizeHtml } from '@/lib/sanitize'

interface SafeHtmlProps {
  html: string | null | undefined
  className?: string
  as?: keyof JSX.IntrinsicElements
}

/**
 * Renders HTML content safely by sanitizing it with DOMPurify.
 * Use this instead of dangerouslySetInnerHTML for any user/database content.
 */
export function SafeHtml({ html, className, as: Tag = 'div' }: SafeHtmlProps) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html])

  if (!sanitized) {
    return null
  }

  return (
    <Tag
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className={className}
    />
  )
}
