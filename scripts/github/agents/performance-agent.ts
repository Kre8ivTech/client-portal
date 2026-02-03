#!/usr/bin/env tsx
/**
 * Performance Review Agent
 * Analyzes query efficiency, bundle size, memory usage, and complexity
 */

import { execSync } from 'child_process'
import type { GitHubPRData, AgentReviewResult, ReviewComment, PerformanceIssue } from '../types'

export async function executePerformanceReview(
  prData: GitHubPRData,
  diff: string
): Promise<AgentReviewResult> {
  const startTime = Date.now()
  const comments: ReviewComment[] = []
  const issues: PerformanceIssue[] = []

  // Check for N+1 query patterns
  const n1Issues = checkN1Queries(prData.files, diff)
  issues.push(...n1Issues)

  // Check for inefficient Supabase queries
  const queryIssues = checkSupabaseQueries(prData.files, diff)
  issues.push(...queryIssues)

  // Check complexity (cyclomatic complexity)
  const complexityIssues = checkComplexity(prData.files, diff)
  issues.push(...complexityIssues)

  // Check React Query patterns
  const reactQueryIssues = checkReactQueryPatterns(prData.files, diff)
  issues.push(...reactQueryIssues)

  // Check bundle size impact (if build output available)
  const bundleIssues = await checkBundleSize(prData.files)
  issues.push(...bundleIssues)

  // Convert issues to review comments
  for (const issue of issues) {
    comments.push(convertIssueToComment(issue))
  }

  const executionTime = Date.now() - startTime
  const criticalIssues = issues.filter((i) => i.severity === 'critical' || i.severity === 'high')
  const passed = criticalIssues.length === 0

  return {
    agentName: 'performance',
    comments,
    summary: generateSummary(issues),
    passed,
    executionTime,
  }
}

function checkN1Queries(files: any[], diff: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(ts|tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n')

    // Detect N+1 patterns: loop with Supabase query inside
    let inLoop = false
    let loopStart = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect loop start
      if (line.match(/\.(map|forEach|for)\s*\(/)) {
        inLoop = true
        loopStart = i + 1
      }

      // Detect Supabase query inside loop
      if (inLoop && line.includes('supabase.from(')) {
        issues.push({
          type: 'N+1 Query Pattern',
          file: filePath,
          line: i + 1,
          description: `Potential N+1 query detected. Supabase query inside a loop can cause performance issues.`,
          impact: `If the loop runs N times, this will execute N+1 database queries instead of 1, causing significant slowdown.`,
          suggestedFix: `Use a single query with \`.in()\` filter:\n\`\`\`typescript\n// WRONG\nfor (const item of items) {\n  const { data } = await supabase.from('table').select('*').eq('id', item.id)\n}\n\n// CORRECT\nconst ids = items.map(item => item.id)\nconst { data } = await supabase.from('table').select('*').in('id', ids)\n\`\`\``,
          severity: 'high',
        })
      }

      // Detect loop end
      if (inLoop && line.match(/^\s*\}/)) {
        inLoop = false
      }
    }
  }

  return issues
}

function checkSupabaseQueries(files: any[], diff: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(ts|tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for .select('*') without limiting columns
      if (line.match(/\.select\(['"]?\*['"]?\)/)) {
        issues.push({
          type: 'Inefficient Query: SELECT *',
          file: filePath,
          line: i + 1,
          description: `Using \`.select('*')\` fetches all columns. Specify only needed columns for better performance.`,
          impact: `Fetching unnecessary data increases network payload and database load.`,
          suggestedFix: `Specify only needed columns:\n\`\`\`typescript\n// WRONG\nconst { data } = await supabase.from('tickets').select('*')\n\n// CORRECT\nconst { data } = await supabase.from('tickets').select('id, subject, status, created_at')\n\`\`\``,
          severity: 'medium',
        })
      }

      // Check for missing .single() when expecting one row
      if (line.includes('.eq(') && !line.includes('.single()') && !line.includes('.maybeSingle()')) {
        const nextLine = lines[i + 1] || ''
        if (!nextLine.includes('.single()') && !nextLine.includes('.maybeSingle()')) {
          issues.push({
            type: 'Missing .single() Hint',
            file: filePath,
            line: i + 1,
            description: `Query uses \`.eq()\` which suggests single row expected, but \`.single()\` not used.`,
            impact: `Database returns array even for single result, causing unnecessary overhead.`,
            suggestedFix: `Use \`.single()\` if expecting one row:\n\`\`\`typescript\nconst { data } = await supabase.from('tickets').select('*').eq('id', ticketId).single()\n\`\`\``,
            severity: 'low',
          })
        }
      }

      // Check for missing indexes on frequently queried columns
      if (line.match(/\.eq\(['"]organization_id['"]/)) {
        // This is OK, organization_id should be indexed
        // Check if it's in a migration file without index
        if (filePath.includes('migrations') && !content.includes('CREATE INDEX')) {
          issues.push({
            type: 'Missing Index on organization_id',
            file: filePath,
            line: i + 1,
            description: `Querying by \`organization_id\` without index. Add index for better performance.`,
            impact: `Queries will do full table scans, causing slow performance as data grows.`,
            suggestedFix: `Add index in migration:\n\`\`\`sql\nCREATE INDEX idx_tickets_organization_id ON tickets(organization_id);\n\`\`\``,
            severity: 'medium',
          })
        }
      }
    }
  }

  return issues
}

function checkComplexity(files: any[], diff: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(ts|tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    // Simple cyclomatic complexity calculation
    const complexity = calculateComplexity(content)

    if (complexity > 15) {
      issues.push({
        type: 'High Cyclomatic Complexity',
        file: filePath,
        line: 1,
        description: `Function has cyclomatic complexity of ${complexity}, exceeding threshold of 15.`,
        impact: `High complexity makes code harder to test, maintain, and understand.`,
        suggestedFix: `Refactor to reduce complexity:\n- Extract helper functions\n- Use early returns\n- Simplify conditional logic\n- Use lookup tables instead of switch statements`,
        severity: complexity > 20 ? 'high' : 'medium',
        metrics: { complexity },
      })
    }
  }

  return issues
}

function calculateComplexity(code: string): number {
  // Simple complexity calculation: count decision points
  let complexity = 1 // Base complexity

  // Count if, else if, for, while, case, catch, &&, ||
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /&&/g,
    /\|\|/g,
  ]

  for (const pattern of patterns) {
    const matches = code.match(pattern)
    if (matches) complexity += matches.length
  }

  return complexity
}

function checkReactQueryPatterns(files: any[], diff: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  for (const file of files) {
    const filePath = file.path
    if (!filePath.match(/\.(tsx)$/)) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n')

    // Check for useEffect with fetch instead of React Query
    let inUseEffect = false
    let useEffectLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.includes('useEffect(')) {
        inUseEffect = true
        useEffectLine = i + 1
      }

      if (
        inUseEffect &&
        (line.includes('fetch(') || line.includes('supabase.from('))
      ) {
        issues.push({
          type: 'Data Fetching in useEffect',
          file: filePath,
          line: i + 1,
          description: `Data fetching in useEffect instead of React Query. This misses caching, automatic refetching, and other benefits.`,
          impact: `No caching, manual loading/error states, potential race conditions.`,
          suggestedFix: `Use React Query:\n\`\`\`typescript\n// WRONG\nuseEffect(() => {\n  fetch('/api/data').then(...)\n}, [])\n\n// CORRECT\nconst { data, isLoading } = useQuery({\n  queryKey: ['data'],\n  queryFn: async () => {\n    const res = await fetch('/api/data')\n    return res.json()\n  }\n})\n\`\`\``,
          severity: 'medium',
        })
      }

      if (inUseEffect && line.includes('}')) {
        inUseEffect = false
      }
    }
  }

  return issues
}

async function checkBundleSize(files: any[]): Promise<PerformanceIssue[]> {
  const issues: PerformanceIssue[] = []

  // Check if any large dependencies added
  const hasPackageJson = files.some((f) => f.path.includes('package.json'))

  if (hasPackageJson) {
    try {
      // Run bundle size analysis (if available)
      // This would require a build to be run first
      // For now, just check for known large packages
      const packageJson = require(process.cwd() + '/package.json')
      const largeDeps = ['lodash', 'moment', 'rxjs']

      for (const dep of largeDeps) {
        if (packageJson.dependencies?.[dep]) {
          issues.push({
            type: 'Large Dependency Added',
            file: 'package.json',
            line: 1,
            description: `Large dependency "${dep}" added. Consider lighter alternatives.`,
            impact: `Increases bundle size, slowing down initial page load.`,
            suggestedFix: `Alternatives:\n- lodash → lodash-es (tree-shakeable) or native JS\n- moment → date-fns or dayjs\n- rxjs → native Promises/async`,
            severity: 'medium',
          })
        }
      }
    } catch (error) {
      // Ignore if can't read package.json
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

function convertIssueToComment(issue: PerformanceIssue): ReviewComment {
  return {
    path: issue.file,
    line: issue.line,
    severity: issue.severity,
    category: 'performance',
    body: formatPerformanceComment(issue),
    suggestion: issue.suggestedFix,
  }
}

function formatPerformanceComment(issue: PerformanceIssue): string {
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  }[issue.severity]

  return `
⚡ **Performance Impact: ${issue.type}**

**Severity**: ${severityEmoji} ${issue.severity.toUpperCase()}

**Description**:
${issue.description}

**Impact**:
${issue.impact}

**Suggested Fix**:
${issue.suggestedFix}

${issue.metrics ? `**Metrics**: ${JSON.stringify(issue.metrics)}` : ''}

**References**:
- [KT-Portal Performance Patterns](docs/CLAUDE.md#key-patterns)
  `.trim()
}

function generateSummary(issues: PerformanceIssue[]): string {
  const total = issues.length
  const high = issues.filter((i) => i.severity === 'high').length
  const medium = issues.filter((i) => i.severity === 'medium').length

  if (total === 0) {
    return '✅ No performance issues detected'
  }

  return `
⚡ **Performance Review Summary**

**Total Issues**: ${total}
- 🟠 High: ${high}
- 🟡 Medium: ${medium}

${high > 0 ? '⚠️ High-impact performance issues detected. Consider optimizing before merge.' : ''}
  `.trim()
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: performance-agent.ts --pr=<pr-number>')
    process.exit(1)
  }

  // Import and execute
  import('../gh-utils').then(async ({ getPRData, getPRDiff }) => {
    const prData = await getPRData(prNumber)
    const diff = await getPRDiff(prNumber)
    const result = await executePerformanceReview(prData, diff)

    console.log(JSON.stringify(result, null, 2))
    process.exit(result.passed ? 0 : 1)
  })
}
