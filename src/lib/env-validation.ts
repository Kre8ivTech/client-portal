const REQUIRED_SERVER_ENV_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const

/**
 * Validate critical environment variables at startup.
 * Throws an Error in server environments when required values are missing.
 */
export function validateEnvironment(): void {
  const missing = REQUIRED_SERVER_ENV_VARS.filter((key) => {
    const value = process.env[key]
    return typeof value !== "string" || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
}
