#!/usr/bin/env tsx
/**
 * Security Review Agent
 * Checks for security vulnerabilities, secrets, RLS policies, and auth issues
 */

import type {
  GitHubPRData,
  AgentReviewResult,
  ReviewComment,
  SecurityIssue,
} from '../types'

const SEVERITY_MAP = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const

// Patterns for detecting hardcoded secrets
const SECRET_PATTERNS = [
  {
    pattern: /(?:api[_-]?key|apikey)[\s]*[=:][\s]*['"]([^'"]{20,})['"]/gi,
    type: 'API Key',
  },
  {
    pattern: /(?:secret|password|passwd|pwd)[\s]*[=:][\s]*['"]([^'"]{8,})['"]/gi,
    type: 'Password/Secret',
  },
  {
    pattern: /(?:token|auth[_-]?token)[\s]*[=:][\s]*['"]([^'"]{20,})['"]/gi,
    type: 'Auth Token',
  },
  {
    pattern: /(?:SUPABASE_SERVICE_ROLE_KEY)[\s]*[=:][\s]*['"]([^'"]+)['"]/gi,
    type: 'Supabase Service Role Key',
  },
  {
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    type: 'Stripe Live Secret Key',
  },
  {
    pattern: /eyJ[a-zA-Z0-9_-]{30,}\.eyJ[a-zA-Z0-9_-]{30,}/g,
    type: 'JWT Token',
  },
]

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  {
    pattern: /\$\{[^}]*\}\s*(?:FROM|WHERE|SELECT|INSERT|UPDATE|DELETE)/gi,
    type: 'Template Literal SQL Injection',
  },
  {
    pattern: /['"][\s]*\+[\s]*\w+[\s]*\+[\s]*['"]/g,
    type: 'String Concatenation SQL',
  },
  {
    pattern: /execSync\s*\([^)]*\$\{/g,
    type: 'Command Injection via execSync',
  },
]

// XSS patterns
const XSS_PATTERNS = [
  {
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\{[\s]*__html:/g,
    type: 'dangerouslySetInnerHTML Usage',
  },
  {
    pattern: /innerHTML\s*=/g,
    type: 'Direct innerHTML Assignment',
  },
  {
    pattern: /document\.write\(/g,
    type: 'document.write Usage',
  },
]

export async function executeSecurityReview(
  prData: GitHubPRData,
  diff: string
): Promise<AgentReviewResult> {
  const startTime = Date.now()
  const comments: ReviewComment[] = []
  const issues: SecurityIssue[] = []

  // Check each file
  for (const file of prData.files) {
    const filePath = file.path

    // Skip non-code files
    if (
      !filePath.match(/\.(ts|tsx|js|jsx|sql)$/) ||
      filePath.includes('node_modules') ||
      filePath.includes('.next')
    ) {
      continue
    }

    // Get file content from diff
    const fileContent = extractFileContent(diff, filePath)
    if (!fileContent) continue

    // Check for hardcoded secrets
    const secretIssues = checkHardcodedSecrets(filePath, fileContent)
    issues.push(...secretIssues)

    // Check for SQL injection
    const sqlIssues = checkSQLInjection(filePath, fileContent)
    issues.push(...sqlIssues)

    // Check for XSS vulnerabilities
    const xssIssues = checkXSS(filePath, fileContent)
    issues.push(...xssIssues)

    // Check service role usage (must be server-side only)
    const serviceRoleIssues = checkServiceRoleUsage(filePath, fileContent)
    issues.push(...serviceRoleIssues)

    // Check for missing input validation
    const validationIssues = checkInputValidation(filePath, fileContent)
    issues.push(...validationIssues)

    // Check RLS policies for new tables
    if (filePath.includes('migrations') && filePath.endsWith('.sql')) {
      const rlsIssues = checkRLSPolicies(filePath, fileContent)
      issues.push(...rlsIssues)
    }
  }

  // Convert issues to review comments
  for (const issue of issues) {
    comments.push(convertIssueToComment(issue))
  }

  const executionTime = Date.now() - startTime
  const criticalIssues = issues.filter((i) => i.severity === 'critical')
  const passed = criticalIssues.length === 0

  return {
    agentName: 'security',
    comments,
    summary: generateSummary(issues),
    passed,
    executionTime,
  }
}

function extractFileContent(diff: string, filePath: string): string | null {
  const filePattern = new RegExp(`diff --git a/${filePath} b/${filePath}([\\s\\S]*?)(?=diff --git|$)`)
  const match = diff.match(filePattern)
  return match ? match[1] : null
}

function checkHardcodedSecrets(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  // Exclude .env files and test files from secret detection
  if (filePath.includes('.env') || filePath.includes('.test.')) {
    return issues
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    for (const { pattern, type } of SECRET_PATTERNS) {
      const matches = line.matchAll(pattern)
      for (const match of matches) {
        issues.push({
          type: `Hardcoded ${type}`,
          file: filePath,
          line: lineNumber,
          description: `Potential hardcoded ${type.toLowerCase()} detected. Secrets should never be committed to the repository.`,
          impact:
            'Critical security risk. Exposed secrets can be used to compromise the entire system.',
          suggestedFix: `Move to environment variables:\n\`\`\`typescript\nconst ${type.replace(/\s+/g, '_').toUpperCase()} = process.env.${type.replace(/\s+/g, '_').toUpperCase()}\n\`\`\``,
          owaspLink: 'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
          severity: 'critical',
        })
      }
    }
  }

  return issues
}

function checkSQLInjection(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    for (const { pattern, type } of SQL_INJECTION_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          type: `SQL Injection - ${type}`,
          file: filePath,
          line: lineNumber,
          description: `Potential SQL injection vulnerability detected. User input is being directly interpolated into SQL queries.`,
          impact: 'Critical. Attackers can execute arbitrary SQL commands, leading to data theft or corruption.',
          suggestedFix: `Use parameterized queries with Supabase:\n\`\`\`typescript\n// WRONG\nconst { data } = await supabase.rpc('custom_query', { param: \\\`\${userInput}\\\` })\n\n// CORRECT\nconst { data } = await supabase.from('table').select('*').eq('column', userInput)\n\`\`\``,
          owaspLink: 'https://owasp.org/www-community/attacks/SQL_Injection',
          severity: 'critical',
        })
      }
    }
  }

  return issues
}

function checkXSS(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    for (const { pattern, type } of XSS_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          type: `XSS - ${type}`,
          file: filePath,
          line: lineNumber,
          description: `Potential XSS vulnerability detected. Rendering user-controlled content without sanitization.`,
          impact: 'High. Attackers can inject malicious scripts to steal credentials or perform actions on behalf of users.',
          suggestedFix: `Use safe React rendering or sanitize with DOMPurify:\n\`\`\`typescript\n// WRONG\n<div dangerouslySetInnerHTML={{ __html: userInput }} />\n\n// CORRECT (if HTML needed)\nimport DOMPurify from 'dompurify'\n<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />\n\n// BETTER (avoid HTML entirely)\n<div>{userInput}</div>\n\`\`\``,
          owaspLink: 'https://owasp.org/www-community/attacks/xss/',
          severity: 'high',
        })
      }
    }
  }

  return issues
}

function checkServiceRoleUsage(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  // Service role should NEVER be used in client-side code
  const isClientSide =
    filePath.includes('components/') ||
    filePath.includes('hooks/') ||
    content.includes("'use client'")

  if (isClientSide && content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('SUPABASE_SERVICE_ROLE_KEY')) {
        issues.push({
          type: 'Service Role Key Exposure',
          file: filePath,
          line: i + 1,
          description: `Service role key used in client-side code. This bypasses Row Level Security and exposes admin credentials.`,
          impact:
            'Critical. Attackers can access all data in the database, bypassing all security policies.',
          suggestedFix: `Use the anon key in client components:\n\`\`\`typescript\n// WRONG (in client component)\nimport { supabaseAdmin } from '@/lib/supabase/admin'\n\n// CORRECT\nimport { createClient } from '@/lib/supabase/client'\nconst supabase = createClient()\n\`\`\`\n\nService role should only be used in:\n- API routes (app/api/**/route.ts)\n- Server components\n- Server actions`,
          owaspLink: 'https://owasp.org/www-community/vulnerabilities/Exposed_Sensitive_Information',
          severity: 'critical',
        })
      }
    }
  }

  return issues
}

function checkInputValidation(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  // Check API routes for missing validation
  if (filePath.includes('/api/') && filePath.endsWith('route.ts')) {
    let hasZodValidation = false
    let hasRequestBody = false

    for (const line of lines) {
      if (line.includes('.safeParse(') || line.includes('.parse(')) {
        hasZodValidation = true
      }
      if (line.includes('request.json()') || line.includes('request.formData()')) {
        hasRequestBody = true
      }
    }

    if (hasRequestBody && !hasZodValidation) {
      issues.push({
        type: 'Missing Input Validation',
        file: filePath,
        line: 1,
        description: `API route processes request body without Zod validation. All user inputs must be validated.`,
        impact: 'Medium. Unexpected input can cause errors or security vulnerabilities.',
        suggestedFix: `Add Zod validation:\n\`\`\`typescript\nimport { z } from 'zod'\n\nconst schema = z.object({\n  field: z.string().min(1).max(100),\n})\n\nconst body = await request.json()\nconst result = schema.safeParse(body)\nif (!result.success) {\n  return NextResponse.json(\n    { error: 'Validation failed', details: result.error.flatten() },\n    { status: 400 }\n  )\n}\n\`\`\``,
        severity: 'medium',
      })
    }
  }

  return issues
}

function checkRLSPolicies(filePath: string, content: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  let hasCreateTable = false
  let hasEnableRLS = false
  let tableName = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect table creation
    if (line.match(/CREATE TABLE/i)) {
      hasCreateTable = true
      const match = line.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i)
      if (match) tableName = match[1]
    }

    // Check for RLS enablement
    if (line.match(/ENABLE ROW LEVEL SECURITY/i)) {
      hasEnableRLS = true
    }
  }

  // If table created without RLS, flag it
  if (hasCreateTable && !hasEnableRLS && tableName) {
    issues.push({
      type: 'Missing RLS Policy',
      file: filePath,
      line: 1,
      description: `Table "${tableName}" created without Row Level Security enabled. All tables must have RLS for multi-tenant isolation.`,
      impact:
        'Critical. Users can access data from other organizations, violating tenant isolation.',
      suggestedFix: `Enable RLS and add policies:\n\`\`\`sql\nALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n\n-- Users can only view their org's data\nCREATE POLICY "Users can view org ${tableName}"\n  ON ${tableName} FOR SELECT\n  USING (\n    organization_id IN (\n      SELECT organization_id FROM profiles\n      WHERE id = auth.uid()\n    )\n  );\n\`\`\``,
      owaspLink: 'https://owasp.org/www-community/Broken_Access_Control',
      severity: 'critical',
    })
  }

  return issues
}

function convertIssueToComment(issue: SecurityIssue): ReviewComment {
  return {
    path: issue.file,
    line: issue.line,
    severity: issue.severity,
    category: 'security',
    body: formatSecurityComment(issue),
    suggestion: issue.suggestedFix,
    references: issue.owaspLink ? [issue.owaspLink] : undefined,
  }
}

function formatSecurityComment(issue: SecurityIssue): string {
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  }[issue.severity]

  return `
🔒 **Security Issue: ${issue.type}**

**Severity**: ${severityEmoji} ${issue.severity.toUpperCase()}

**Description**:
${issue.description}

**Impact**:
${issue.impact}

**Suggested Fix**:
${issue.suggestedFix}

${issue.owaspLink ? `**References**:\n- [OWASP Guide](${issue.owaspLink})\n- [KT-Portal Security Patterns](docs/tech.md#security)` : ''}
  `.trim()
}

function generateSummary(issues: SecurityIssue[]): string {
  const critical = issues.filter((i) => i.severity === 'critical').length
  const high = issues.filter((i) => i.severity === 'high').length
  const medium = issues.filter((i) => i.severity === 'medium').length
  const low = issues.filter((i) => i.severity === 'low').length

  const total = issues.length

  if (total === 0) {
    return '✅ No security issues detected'
  }

  return `
🔒 **Security Review Summary**

**Total Issues**: ${total}
- 🔴 Critical: ${critical}
- 🟠 High: ${high}
- 🟡 Medium: ${medium}
- 🟢 Low: ${low}

${critical > 0 ? '⚠️ **PR BLOCKED**: Critical security issues must be resolved before merging.' : ''}
  `.trim()
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: security-agent.ts --pr=<pr-number>')
    process.exit(1)
  }

  // Import and execute
  import('../gh-utils').then(async ({ getPRData, getPRDiff }) => {
    const prData = await getPRData(prNumber)
    const diff = await getPRDiff(prNumber)
    const result = await executeSecurityReview(prData, diff)

    console.log(JSON.stringify(result, null, 2))
    process.exit(result.passed ? 0 : 1)
  })
}
