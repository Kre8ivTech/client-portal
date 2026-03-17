const REQUIRED_SERVER_ENV_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const

/**
 * Validate critical environment variables at startup.
 * During build (next build), logs a warning instead of throwing.
 * At runtime, throws an Error when required values are missing.
 */
export function validateEnvironment(): void {
  const missing = REQUIRED_SERVER_ENV_VARS.filter((key) => {
    const value = process.env[key]
    return typeof value !== "string" || value.trim().length === 0
  })

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`
    // During next build, NEXT_PHASE is set to 'phase-production-build'
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    if (isBuildPhase) {
      console.warn(`[env-validation] WARNING: ${message}`)
      return
    }
    throw new Error(message)
  }
}
