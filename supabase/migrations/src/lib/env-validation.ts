/**
 * Environment Variable Validation
 *
 * SECURITY: Validates critical environment variables on startup to catch
 * configuration errors early and prevent silent failures.
 *
 * This runs during:
 * - Build time (Next.js build process)
 * - Runtime (server startup)
 * - Development (next dev)
 *
 * Prevents:
 * - Missing required credentials
 * - Weak encryption keys
 * - Placeholder values in production
 * - Silent security misconfigurations
 */

interface ValidationError {
  variable: string;
  message: string;
  severity: "critical" | "warning";
}

/**
 * Validate environment variables for security and functionality
 *
 * @throws {Error} If critical validations fail
 */
export function validateEnvironment(): void {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const env = process.env.NODE_ENV || "development";
  const isProduction = env === "production";
  const isTest = env === "test";

  // Skip validation in test environment
  if (isTest) {
    return;
  }

  // ========================================
  // CRITICAL: Required for all environments
  // ========================================

  // Supabase Configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Supabase URL is required. Get from Supabase Dashboard > Settings > API.",
      severity: "critical",
    });
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
    errors.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Supabase URL contains placeholder value. Update with real URL.",
      severity: "critical",
    });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push({
      variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      message:
        "Supabase anon key is required. Get from Supabase Dashboard > Settings > API.",
      severity: "critical",
    });
  } else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("placeholder")) {
    errors.push({
      variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      message: "Supabase anon key contains placeholder value. Update with real key.",
      severity: "critical",
    });
  }

  // ========================================
  // CRITICAL: Server-side only
  // ========================================

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push({
      variable: "SUPABASE_SERVICE_ROLE_KEY",
      message:
        "Supabase service role key is required for server-side operations. " +
        "Get from Supabase Dashboard > Settings > API. " +
        "NEVER expose to client code.",
      severity: "critical",
    });
  } else if (process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")) {
    errors.push({
      variable: "SUPABASE_SERVICE_ROLE_KEY",
      message:
        "Supabase service role key contains placeholder value. Update with real key.",
      severity: "critical",
    });
  }

  // ========================================
  // CRITICAL: Encryption
  // ========================================

  if (!process.env.ENCRYPTION_SECRET) {
    errors.push({
      variable: "ENCRYPTION_SECRET",
      message:
        "ENCRYPTION_SECRET is required for encrypting sensitive data (AWS credentials, OAuth tokens). " +
        "Generate with: openssl rand -base64 32",
      severity: "critical",
    });
  } else {
    const secretLength = process.env.ENCRYPTION_SECRET.length;

    if (secretLength < 32) {
      errors.push({
        variable: "ENCRYPTION_SECRET",
        message:
          `ENCRYPTION_SECRET is too short (${secretLength} characters). ` +
          `Must be at least 32 characters for security. ` +
          `Generate with: openssl rand -base64 32`,
        severity: "critical",
      });
    } else if (secretLength < 64) {
      warnings.push({
        variable: "ENCRYPTION_SECRET",
        message:
          `ENCRYPTION_SECRET is ${secretLength} characters. ` +
          `Consider using 64+ characters for maximum security.`,
        severity: "warning",
      });
    }

    if (process.env.ENCRYPTION_SECRET.includes("placeholder")) {
      errors.push({
        variable: "ENCRYPTION_SECRET",
        message: "ENCRYPTION_SECRET contains placeholder value. Generate real secret.",
        severity: "critical",
      });
    }
  }

  // ========================================
  // PRODUCTION: Required
  // ========================================

  if (isProduction) {
    // Cron Secret
    if (!process.env.CRON_SECRET) {
      errors.push({
        variable: "CRON_SECRET",
        message:
          "CRON_SECRET is required in production to prevent unauthorized cron job execution. " +
          "Generate with: openssl rand -hex 32",
        severity: "critical",
      });
    } else if (process.env.CRON_SECRET.length < 32) {
      warnings.push({
        variable: "CRON_SECRET",
        message:
          `CRON_SECRET is too short (${process.env.CRON_SECRET.length} characters). ` +
          `Recommend 32+ characters.`,
        severity: "warning",
      });
    }

    // Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      errors.push({
        variable: "STRIPE_SECRET_KEY",
        message:
          "STRIPE_SECRET_KEY is required in production for payment processing. " +
          "Get from Stripe Dashboard > Developers > API Keys.",
        severity: "critical",
      });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      warnings.push({
        variable: "STRIPE_WEBHOOK_SECRET",
        message:
          "STRIPE_WEBHOOK_SECRET recommended for webhook signature verification. " +
          "Get from Stripe Dashboard > Developers > Webhooks.",
        severity: "warning",
      });
    }

    // Email
    if (!process.env.RESEND_API_KEY) {
      errors.push({
        variable: "RESEND_API_KEY",
        message:
          "RESEND_API_KEY is required in production for sending emails. " +
          "Get from Resend Dashboard > API Keys.",
        severity: "critical",
      });
    }

    // App URL
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      warnings.push({
        variable: "NEXT_PUBLIC_APP_URL",
        message:
          "NEXT_PUBLIC_APP_URL recommended for absolute URLs (emails, redirects). " +
          "Set to: https://your-domain.com",
        severity: "warning",
      });
    } else if (
      process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ||
      process.env.NEXT_PUBLIC_APP_URL.includes("127.0.0.1")
    ) {
      warnings.push({
        variable: "NEXT_PUBLIC_APP_URL",
        message:
          "NEXT_PUBLIC_APP_URL points to localhost in production. " +
          "Update to production domain.",
        severity: "warning",
      });
    }
  }

  // ========================================
  // OPTIONAL: Integrations (Warnings Only)
  // ========================================

  // AI Assistant
  if (!process.env.ANTHROPIC_API_KEY && !isProduction) {
    warnings.push({
      variable: "ANTHROPIC_API_KEY",
      message:
        "ANTHROPIC_API_KEY not set. AI chatbot features will be disabled. " +
        "Get from: https://console.anthropic.com/",
      severity: "warning",
    });
  }

  // AWS S3 (optional - can be configured in app)
  const hasAwsConfig =
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME;

  if (!hasAwsConfig && !isProduction) {
    warnings.push({
      variable: "AWS_*",
      message:
        "AWS S3 credentials not set. File storage will use Supabase Storage. " +
        "To use S3, set: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME",
      severity: "warning",
    });
  }

  // ========================================
  // Report Errors and Warnings
  // ========================================

  if (errors.length > 0 || warnings.length > 0) {
    console.log("\n========================================");
    console.log("Environment Validation Results");
    console.log("========================================\n");

    if (errors.length > 0) {
      console.error("❌ CRITICAL ERRORS:\n");
      errors.forEach((error) => {
        console.error(`  ${error.variable}:`);
        console.error(`    ${error.message}\n`);
      });
    }

    if (warnings.length > 0) {
      console.warn("⚠️  WARNINGS:\n");
      warnings.forEach((warning) => {
        console.warn(`  ${warning.variable}:`);
        console.warn(`    ${warning.message}\n`);
      });
    }

    console.log("========================================\n");

    // Throw error if critical validations fail
    if (errors.length > 0) {
      throw new Error(
        `Environment validation failed with ${errors.length} critical error(s). ` +
          `Fix the issues above and restart the server.`,
      );
    }
  } else {
    console.log("✅ Environment validation passed\n");
  }
}

/**
 * Validate environment variables for client-side code
 *
 * Only validates NEXT_PUBLIC_* variables accessible in browser.
 * Called from client components to catch configuration errors early.
 */
export function validateClientEnvironment(): void {
  const errors: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

  if (errors.length > 0) {
    throw new Error(
      "Client environment validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"),
    );
  }
}

/**
 * Get environment information for debugging (safe to log)
 *
 * @returns Safe environment information (no secrets)
 */
export function getEnvironmentInfo(): {
  nodeEnv: string;
  isProduction: boolean;
  hasSupabase: boolean;
  hasStripe: boolean;
  hasResend: boolean;
  hasAnthropic: boolean;
  hasAwsS3: boolean;
} {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    hasSupabase: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    hasStripe: !!(
      process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ),
    hasResend: !!process.env.RESEND_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasAwsS3: !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET_NAME
    ),
  };
}
