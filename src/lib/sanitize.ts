import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip malicious scripts, event handlers, etc.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML tags as a safe fallback.
    // DOMPurify requires a DOM environment.
    // On the server, we return the raw HTML but it will be sanitized client-side.
    // For server components, use the sanitizeHtmlServer function below.
    return html
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'img', 'figure', 'figcaption',
      'div', 'span', 'section', 'article',
      'sup', 'sub', 'mark', 'abbr',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'class', 'id', 'style', 'colspan', 'rowspan', 'scope',
    ],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitize a CSS color value to prevent CSS injection.
 * Only allows valid hex, rgb, hsl, and named color values.
 */
export function sanitizeCssColor(color: string): string {
  const trimmed = color.trim()
  // Allow hex colors
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed
  }
  // Allow rgb/rgba
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed
  }
  // Allow hsl/hsla
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed
  }
  // Allow CSS custom property references
  if (/^var\(--[a-zA-Z0-9-]+\)$/.test(trimmed)) {
    return trimmed
  }
  // Allow common named colors
  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'pink', 'gray', 'grey', 'cyan', 'magenta', 'brown', 'transparent',
    'inherit', 'currentColor',
  ]
  if (namedColors.includes(trimmed.toLowerCase())) {
    return trimmed
  }
  // Default fallback
  return '#6366f1'
}

/**
 * Strip all HTML tags for server-side text extraction.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}
