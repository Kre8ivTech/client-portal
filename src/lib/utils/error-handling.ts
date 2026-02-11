/**
 * Error handling utilities for database operations
 */

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  const col = escapeRegex(column.toLowerCase());
  
  // Check for PostgreSQL error code 42703 (undefined_column) with column name in message
  // Pattern: "column <table>.<column> does not exist" or "column <column> does not exist"
  if (error.code === '42703') {
    const columnPattern = new RegExp(`column\\s+(?:\\w+\\.)?${col}\\s+does not exist`, 'i');
    if (columnPattern.test(message)) return true;
  }
  
  // Check for schema cache error patterns
  const colLower = column.toLowerCase();
  if (m.includes("schema cache") && (m.includes(`'${colLower}'`) || m.includes(`"${colLower}"`))) {
    return true;
  }
  
  // Check for generic "does not exist" pattern with column name
  // Pattern: "column <optional-table>.<column> does not exist"
  const genericPattern = new RegExp(`column\\s+(?:\\w+\\.)?${col}\\s+does not exist`, 'i');
  return genericPattern.test(message);
}
