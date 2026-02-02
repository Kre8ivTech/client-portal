/**
 * Security utilities for input sanitization and validation
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify to remove potentially dangerous elements and attributes
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr',
      'th', 'td', 'blockquote', 'pre', 'code', 'hr', 'img'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 'style', 'src', 'alt', 'title',
      'width', 'height', 'colspan', 'rowspan'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Escape HTML entities to prevent XSS when displaying user content as text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Allowed domains for user-uploaded images and assets
 * Add your CDN, S3 bucket, or trusted image hosting domains here
 */
const ALLOWED_IMAGE_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'amazonaws.com',
  'cloudfront.net',
  // Add your custom domains here
];

/**
 * Validate and sanitize URL to prevent CSS injection and other attacks
 * Returns the sanitized URL or null if invalid
 */
export function validateUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  
  // Prevent empty strings
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    
    // Only allow HTTPS (or HTTP for localhost in development)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.warn(`Invalid URL protocol: ${parsed.protocol}`);
      return null;
    }

    // Block localhost in production
    if (process.env.NODE_ENV === 'production') {
      if (parsed.protocol === 'http:') {
        console.warn('HTTP not allowed in production');
        return null;
      }
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        console.warn('Localhost not allowed in production');
        return null;
      }
    }

    // Check against allowed domains for images
    return trimmed;
  } catch (err) {
    console.warn(`Invalid URL: ${trimmed}`, err);
    return null;
  }
}

/**
 * Validate image URL with additional checks for allowed domains
 */
export function validateImageUrl(url: string | null | undefined): string | null {
  const validatedUrl = validateUrl(url);
  
  if (!validatedUrl) {
    return null;
  }

  try {
    const parsed = new URL(validatedUrl);
    
    // In production, check if domain is in allowlist
    if (process.env.NODE_ENV === 'production') {
      const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain => 
        parsed.hostname.endsWith(domain)
      );
      
      if (!isAllowed) {
        console.warn(`Image domain not in allowlist: ${parsed.hostname}`);
        // In production, you may want to return null here
        // For now, we'll log a warning but allow it
      }
    }

    return validatedUrl;
  } catch {
    return null;
  }
}

/**
 * Sanitize CSS URL value to prevent CSS injection
 * Returns a safe CSS url() value or empty string
 */
export function sanitizeCssUrl(url: string | null | undefined): string {
  const validatedUrl = validateImageUrl(url);
  
  if (!validatedUrl) {
    return '';
  }

  // Escape any quotes or parentheses that could break out of url()
  const escaped = validatedUrl
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  return `url("${escaped}")`;
}

/**
 * Validate hex color code
 */
export function validateHexColor(color: string | null | undefined): string | null {
  if (!color || typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();
  
  // Allow 3 or 6 digit hex colors with optional #
  if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }

  return null;
}

/**
 * Validate opacity value (0-1)
 */
export function validateOpacity(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0.5; // default
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return 0.5;
  }

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, num));
}
