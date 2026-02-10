/**
 * Error handling utilities for database operations
 */

/**
 * Check if an error is due to a missing database column
 * 
 * This function detects PostgreSQL errors related to missing columns,
 * which is useful for backwards compatibility when database migrations
 * haven't been applied yet.
 * 
 * @param error - The error object from the database query
 * @param column - The name of the column to check for
 * @returns true if the error is about the specified missing column
 * 
 * @example
 * ```typescript
 * const { data, error } = await supabase
 *   .from('services')
 *   .select('*, is_global')
 * 
 * if (error && isMissingColumnError(error, 'is_global')) {
 *   // Retry without the is_global column
 *   const { data: retryData } = await supabase
 *     .from('services')
 *     .select('*')
 * }
 * ```
 */
export function isMissingColumnError(error: any, column: string): boolean {
  if (!error) return false;
  
  // Check for error message first - it should contain the column name
  const message = error.message;
  if (!message) return false;
  const m = message.toLowerCase();
  const col = column.toLowerCase();
  
  // Check for PostgreSQL error code 42703 (undefined_column) with column name in message
  if (error.code === '42703' && m.includes(col)) return true;
  
  // Check for error message patterns
  return (
    (m.includes("schema cache") && (m.includes(`'${col}'`) || m.includes(`"${col}"`))) ||
    (m.includes("does not exist") && m.includes(col))
  );
}
