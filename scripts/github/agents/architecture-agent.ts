#!/usr/bin/env tsx
/**
 * Architecture Review Agent
 * Validates architectural patterns, component organization, and SOLID principles
 */

import type { GitHubPRData, AgentReviewResult, ReviewComment, ArchitectureIssue } from '../types'

export async function executeArchitectureReview(
  prData: GitHubPRData,
  diff: string
): Promise<AgentReviewResult> {
  const startTime = Date.now()
  const comments: ReviewComment[] = []
  const issues: ArchitectureIssue[] = []

  // Check multi-tenancy patterns
  const tenancyIssues = checkMultiTenancyPatterns(prData.files, diff)
  issues.push(...tenancyIssues)

  // Check proper Supabase client usage
  const clientIssues = checkSupabaseClientUsage(prData.files, diff)
  issues.push(...clientIssues)

  // Check Server vs Client Component organization
  const componentIssues = checkComponentOrganization(prData.files, diff)
  issues.push(...componentIssues)

  // Check coupling and cohesion
  const couplingIssues = checkCoupling(prData.files, diff)
  issues.push(...couplingIssues)

  // Convert issues to review comments
  for (const issue of issues) {
    comments.push(convertIssueToComment(issue))
  }

  const executionTime = Date.now() - startTime
  const passed = true // Architecture is advisory, doesn't block

  return {
    agentName: 'architecture',
    comments,
    summary: generateSummary(issues),
    passed,
    executionTime,
  }
}

function checkMultiTenancyPatterns(files: any[], diff: string): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(ts|tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n')

    // Check for queries without organization_id filtering
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect Supabase query
      if (line.includes('supabase.from(')) {
        const tableName = line.match(/from\(['"](\w+)['"]\)/)?.[1]
        if (!tableName) continue

        // Skip if it's a non-tenant table (like app_settings, system tables)
        const nonTenantTables = ['app_settings', 'schema_migrations', 'storage']
        if (nonTenantTables.some((t) => tableName.includes(t))) continue

        // Check if organization_id filter exists in next few lines
        const nextLines = lines.slice(i, i + 5).join('\n')
        if (!nextLines.includes('organization_id') && !nextLines.includes('RLS will handle')) {
          issues.push({
            type: 'Missing Multi-Tenancy Filter',
            file: filePath,
            line: i + 1,
            description: `Query on "${tableName}" without explicit organization_id filter. While RLS provides protection, explicit filtering is clearer.`,
            impact: `Potential tenant data leakage if RLS policies misconfigured. Explicit filtering provides defense in depth.`,
            suggestedFix: `Add explicit organization_id filter:\n\`\`\`typescript\n// Get user's org first\nconst { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()\n\n// Then filter by org\nconst { data } = await supabase.from('${tableName}').select('*').eq('organization_id', profile.organization_id)\n\`\`\``,
            severity: 'medium',
          })
        }
      }
    }
  }

  return issues
}

function checkSupabaseClientUsage(files: any[], diff: string): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = []

  for (const file of files) {
    const filePath = file.path

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    // Check for wrong client usage
    const isClientComponent = content.includes("'use client'")
    const isServerComponent = filePath.includes('/app/') && !isClientComponent
    const isAPIRoute = filePath.includes('/api/') && filePath.endsWith('route.ts')

    if (isClientComponent && content.includes('createServerSupabaseClient')) {
      issues.push({
        type: 'Wrong Supabase Client in Client Component',
        file: filePath,
        line: 1,
        description: `Using server client in client component. This will fail at runtime.`,
        impact: `Runtime errors. Server client requires cookies which aren't available in client components.`,
        suggestedFix: `Use browser client:\n\`\`\`typescript\nimport { createClient } from '@/lib/supabase/client'\nconst supabase = createClient()\n\`\`\``,
        severity: 'high',
      })
    }

    if ((isServerComponent || isAPIRoute) && content.includes('createClient()') && !content.includes('createServerSupabaseClient')) {
      issues.push({
        type: 'Browser Client in Server Context',
        file: filePath,
        line: 1,
        description: `Using browser client in server component/API route. Use server client instead.`,
        impact: `Session management issues, potential auth bypass.`,
        suggestedFix: `Use server client:\n\`\`\`typescript\nimport { createServerSupabaseClient } from '@/lib/supabase/server'\nconst supabase = await createServerSupabaseClient()\n\`\`\``,
        severity: 'high',
      })
    }
  }

  return issues
}

function checkComponentOrganization(files: any[], diff: string): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const isClientComponent = content.includes("'use client'")
    const hasInteractivity = content.includes('useState') || content.includes('onClick') || content.includes('onChange')
    const hasDataFetching = content.includes('useQuery') || content.includes('supabase.from(')

    // Check if Client Component is unnecessary
    if (isClientComponent && !hasInteractivity && !hasDataFetching) {
      issues.push({
        type: 'Unnecessary Client Component',
        file: filePath,
        line: 1,
        description: `Component marked as 'use client' but doesn't use client-side features (hooks, events, etc).`,
        impact: `Larger bundle size, slower hydration. Server Components are more efficient.`,
        suggestedFix: `Remove 'use client' directive to make this a Server Component. Move interactive parts to separate Client Components if needed.`,
        severity: 'low',
      })
    }

    // Check if Server Component is doing client-side work
    if (!isClientComponent && hasInteractivity) {
      issues.push({
        type: 'Interactive Logic in Server Component',
        file: filePath,
        line: 1,
        description: `Server Component uses interactive features (useState, onClick). This will fail.`,
        impact: `Runtime errors. Server Components cannot use client-side hooks or event handlers.`,
        suggestedFix: `Add 'use client' directive or extract interactive parts to a separate Client Component.`,
        severity: 'high',
      })
    }

    // Check file organization
    if (filePath.includes('/components/') && !filePath.match(/components\/(ui|layout|\w+)\//)) {
      issues.push({
        type: 'Component Organization',
        file: filePath,
        line: 1,
        description: `Component not organized by feature/domain. Should be in components/ui/, components/layout/, or components/[feature]/`,
        impact: `Harder to find and maintain components. Poor scalability.`,
        suggestedFix: `Organize by feature:\n- UI primitives: components/ui/\n- Layout: components/layout/\n- Feature-specific: components/tickets/, components/invoices/, etc.`,
        severity: 'low',
      })
    }
  }

  return issues
}

function checkCoupling(files: any[], diff: string): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(ts|tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    // Count imports to measure coupling
    const imports = content.match(/^import .+ from ['"](.+)['"]/gm) || []
    const externalImports = imports.filter((imp) => !imp.includes('../') && !imp.includes('./'))

    if (externalImports.length > 10) {
      issues.push({
        type: 'High Coupling',
        file: filePath,
        line: 1,
        description: `File has ${externalImports.length} external imports, suggesting high coupling.`,
        impact: `High coupling makes code harder to test, reuse, and maintain. Changes ripple across many files.`,
        suggestedFix: `Reduce dependencies:\n- Extract common functionality to utilities\n- Use dependency injection\n- Apply facade pattern\n- Group related imports`,
        severity: 'medium',
        metrics: { coupling: externalImports.length },
      })
    }

    // Check for circular dependencies (basic check)
    const relativeImports = imports.filter((imp) => imp.includes('../'))
    if (relativeImports.length > 3) {
      issues.push({
        type: 'Potential Circular Dependency',
        file: filePath,
        line: 1,
        description: `Many relative imports (${relativeImports.length}) suggest potential circular dependencies.`,
        impact: `Circular dependencies cause build issues and make code harder to understand.`,
        suggestedFix: `Restructure imports:\n- Use absolute imports (@/lib/...)\n- Extract shared code to common modules\n- Apply dependency inversion`,
        severity: 'low',
      })
    }
  }

  return issues
}

function extractFileContent(diff: string, filePath: string): string | null {
  const filePattern = new RegExp(`diff --git a/${filePath} b/${filePath}([\\s\\S]*?)(?=diff --git|$)`)
  const match = diff.match(filePattern)
  if (!match) return null

  // Extract only added lines
  const lines = match[1].split('\n')
  const addedLines = lines
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.substring(1))

  return addedLines.join('\n')
}

function convertIssueToComment(issue: ArchitectureIssue): ReviewComment {
  return {
    path: issue.file,
    line: issue.line || 1,
    severity: issue.severity,
    category: 'architecture',
    body: formatArchitectureComment(issue),
    suggestion: issue.suggestedFix,
  }
}

function formatArchitectureComment(issue: ArchitectureIssue): string {
  return `
🏗️ **Architecture: ${issue.type}**

📋 **Recommendation**

**Description**:
${issue.description}

**Impact**:
${issue.impact}

**Suggested Fix**:
${issue.suggestedFix}

${issue.metrics ? `**Metrics**: ${JSON.stringify(issue.metrics)}` : ''}

**References**:
- [KT-Portal Architecture](docs/CLAUDE.md#architecture)
  `.trim()
}

function generateSummary(issues: ArchitectureIssue[]): string {
  const total = issues.length
  const high = issues.filter((i) => i.severity === 'high').length

  if (total === 0) {
    return '✅ No architectural issues detected'
  }

  return `
🏗️ **Architecture Review Summary**

**Total Recommendations**: ${total}
${high > 0 ? `- 🟠 High Priority: ${high}` : ''}

These are recommendations to improve code quality and maintainability.
  `.trim()
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: architecture-agent.ts --pr=<pr-number>')
    process.exit(1)
  }

  // Import and execute
  import('../gh-utils').then(async ({ getPRData, getPRDiff }) => {
    const prData = await getPRData(prNumber)
    const diff = await getPRDiff(prNumber)
    const result = await executeArchitectureReview(prData, diff)

    console.log(JSON.stringify(result, null, 2))
    process.exit(0) // Always pass for architecture
  })
}
