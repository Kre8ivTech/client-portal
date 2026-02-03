import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-sm', 'font-bold')
      expect(result).toContain('text-sm')
      expect(result).toContain('font-bold')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base-class', isActive && 'active-class')
      expect(result).toContain('base-class')
      expect(result).toContain('active-class')
    })

    it('should filter falsy values', () => {
      const result = cn('text-sm', false, null, undefined, 'font-bold')
      expect(result).toContain('text-sm')
      expect(result).toContain('font-bold')
      expect(result).not.toContain('false')
      expect(result).not.toContain('null')
    })
  })
})
