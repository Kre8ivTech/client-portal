import { describe, it, expect } from 'vitest'
import { isMissingColumnError } from '@/lib/utils/error-handling'

describe('Services API Error Handling', () => {
  describe('isMissingColumnError', () => {
    it('should detect PostgreSQL error code 42703', () => {
      const error = {
        code: '42703',
        message: 'column services.is_global does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should detect "does not exist" error message', () => {
      const error = {
        message: 'column services.is_global does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should detect schema cache error with single quotes', () => {
      const error = {
        message: "schema cache lookup failed for column 'is_global'"
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should detect schema cache error with double quotes', () => {
      const error = {
        message: 'schema cache lookup failed for column "is_global"'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should be case-insensitive for column names', () => {
      const error = {
        message: 'column services.IS_GLOBAL does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should return false for null/undefined error', () => {
      expect(isMissingColumnError(null, 'is_global')).toBe(false)
      expect(isMissingColumnError(undefined, 'is_global')).toBe(false)
    })

    it('should return false for error without message', () => {
      const error = { code: '12345' }
      expect(isMissingColumnError(error, 'is_global')).toBe(false)
    })

    it('should return false for unrelated error message', () => {
      const error = {
        message: 'connection timeout'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(false)
    })

    it('should not match wrong column name', () => {
      const error = {
        message: 'column services.other_column does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(false)
    })

    it('should handle the exact error from the problem statement', () => {
      const error = {
        code: '42703',
        details: null,
        hint: null,
        message: 'column services.is_global does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(true)
    })

    it('should not match error code 42703 for different column', () => {
      const error = {
        code: '42703',
        message: 'column services.other_column does not exist'
      }
      expect(isMissingColumnError(error, 'is_global')).toBe(false)
    })
  })
})
