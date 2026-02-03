#!/usr/bin/env tsx
/**
 * Style Review Agent
 * Checks code style, naming conventions, and project standards
 */

import { execSync } from 'child_process'
import type { GitHubPRData, AgentReviewResult, ReviewComment, StyleIssue } from '../types'

export async function executeStyleReview(
  prData: GitHubPRData,
  diff: string
): Promise<AgentReviewResult> {
  const startTime = Date.now()
  const comments: ReviewComment[] = []
  const issues: StyleIssue[] = []

  // Run ESLint on changed files
  const eslintIssues = await runESLint(prData.files.map((f) => f.path))
  issues.push(...eslintIssues)

  // Check file size limits
  const fileSizeIssues = checkFileSizes(prData.files, diff)
  issues.push(...fileSizeIssues)

  // Check naming conventions
  const namingIssues = checkNamingConventions(prData.files, diff)
  issues.push(...namingIssues)

  // Check for emojis in code/comments
  const emojiIssues = checkForEmojis(prData.files, diff)
  issues.push(...emojiIssues)

  // Check commit message format
  const commitIssues = checkCommitMessages(prData.commits)
  issues.push(...commitIssues)

  // Check TypeScript strict mode compliance
  const tsIssues = await checkTypeScriptStrict(prData.files.map((f) => f.path))
  issues.push(...tsIssues)

  // Convert issues to review comments
  for (const issue of issues) {
    comments.push(convertIssueToComment(issue))
  }

  const executionTime = Date.now() - startTime
  const passed = issues.filter((i) => i.severity === 'high' || i.severity === 'critical').length === 0

  return {
    agentName: 'style',
    comments,
    summary: generateSummary(issues),
    passed,
    executionTime,
  }
}

async function runESLint(files: string[]): Promise<StyleIssue[]> {
  const issues: StyleIssue[] = []

  // Filter to only TypeScript/JavaScript files
  const codeFiles = files.filter((f) =>
    f.match(/\.(ts|tsx|js|jsx)$/) && !f.includes('node_modules') && !f.includes('.next')
  )

  if (codeFiles.length === 0) return issues

  try {
    const output = execSync(`npx eslint ${codeFiles.join(' ')} --format json`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const results = JSON.parse(output)

    for (const result of results) {
      for (const message of result.messages) {
        issues.push({
          type: `ESLint: ${message.ruleId || 'unknown'}`,
          file: result.filePath,
          line: message.line,
          description: message.message,
          suggestedFix: message.fix
            ? `Auto-fix available: run \`npx eslint --fix ${result.filePath}\``
            : 'Manual fix required',
          autoFixable: !!message.fix,
          severity: message.severity === 2 ? 'medium' : 'low',
        })
      }
    }
  } catch (error: any) {
    // ESLint exits with code 1 when issues found
    if (error.stdout) {
      try {
        const results = JSON.parse(error.stdout)
        for (const result of results) {
          for (const message of result.messages) {
            issues.push({
              type: `ESLint: ${message.ruleId || 'unknown'}`,
              file: result.filePath,
              line: message.line,
              description: message.message,
              suggestedFix: message.fix
                ? `Auto-fix available: run \`npx eslint --fix ${result.filePath}\``
                : 'Manual fix required',
              autoFixable: !!message.fix,
              severity: message.severity === 2 ? 'medium' : 'low',
            })
          }
        }
      } catch (parseError) {
        // Ignore parse errors
      }
    }
  }

  return issues
}

function checkFileSizes(files: any[], diff: string): StyleIssue[] {
  const issues: StyleIssue[] = []

  for (const file of files) {
    const filePath = file.path

    // Skip non-code files
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) continue

    // Extract file content from diff
    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n').length

    // Typical: 200-400 lines, Max: 800 lines
    if (lines > 800) {
      issues.push({
        type: 'File Too Large',
        file: filePath,
        line: 1,
        description: `File has ${lines} lines, exceeding the 800 line maximum. Large files are harder to maintain and review.`,
        suggestedFix: `Consider splitting into smaller modules:\n- Extract components to separate files\n- Move utilities to dedicated files\n- Organize by feature/domain`,
        autoFixable: false,
        severity: 'medium',
      })
    } else if (lines > 500) {
      issues.push({
        type: 'File Size Warning',
        file: filePath,
        line: 1,
        description: `File has ${lines} lines, approaching the 800 line maximum. Consider refactoring for better maintainability.`,
        suggestedFix: `Typical file size is 200-400 lines. Consider splitting if file grows larger.`,
        autoFixable: false,
        severity: 'low',
      })
    }
  }

  return issues
}

function checkNamingConventions(files: any[], diff: string): StyleIssue[] {
  const issues: StyleIssue[] = []

  for (const file of files) {
    const filePath = file.path

    // Check branch naming (from PR context)
    // Expected: feature/KT-XXX-description, fix/KT-XXX-description
    // This would be checked at the PR level, not file level

    // Check file naming
    const fileName = filePath.split('/').pop() || ''

    // React components should be PascalCase
    if (
      filePath.includes('/components/') &&
      fileName.match(/\.(tsx|jsx)$/) &&
      !fileName.match(/^[A-Z][a-zA-Z0-9]*\.(tsx|jsx)$/)
    ) {
      issues.push({
        type: 'Component Naming',
        file: filePath,
        line: 1,
        description: `React component file should use PascalCase: "${fileName}"`,
        suggestedFix: `Rename to PascalCase, e.g., "${fileName.charAt(0).toUpperCase() + fileName.slice(1)}"`,
        autoFixable: false,
        severity: 'low',
      })
    }

    // Utility files should be kebab-case
    if (
      filePath.includes('/lib/') &&
      fileName.match(/\.(ts|js)$/) &&
      fileName !== fileName.toLowerCase()
    ) {
      issues.push({
        type: 'Utility File Naming',
        file: filePath,
        line: 1,
        description: `Utility file should use kebab-case: "${fileName}"`,
        suggestedFix: `Rename to kebab-case, e.g., "${fileName.toLowerCase()}"`,
        autoFixable: false,
        severity: 'low',
      })
    }
  }

  return issues
}

function checkForEmojis(files: any[], diff: string): StyleIssue[] {
  const issues: StyleIssue[] = []

  for (const file of files) {
    const filePath = file.path

    // Skip markdown files and test files
    if (filePath.endsWith('.md') || filePath.includes('.test.')) continue

    const content = extractFileContent(diff, filePath)
    if (!content) continue

    const lines = content.split('\n')
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]/u

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (emojiPattern.test(line)) {
        issues.push({
          type: 'Emoji in Code',
          file: filePath,
          line: i + 1,
          description: `Emoji detected in code or comments. Per CLAUDE.md: "No emojis in code, comments, or documentation"`,
          suggestedFix: `Remove emoji or replace with descriptive text`,
          autoFixable: false,
          severity: 'low',
        })
      }
    }
  }

  return issues
}

function checkCommitMessages(commits: any[]): StyleIssue[] {
  const issues: StyleIssue[] = []

  // Check for conventional commits format
  const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+?\))?: .+/

  for (const commit of commits) {
    const message = commit.messageHeadline

    if (!conventionalPattern.test(message)) {
      issues.push({
        type: 'Commit Message Format',
        file: 'commit',
        line: 1,
        description: `Commit message doesn't follow conventional commits format: "${message}"`,
        suggestedFix: `Use format: <type>(<scope>): <description>\n\nExamples:\n- feat(tickets): add queue position display\n- fix(invoices): correct tax calculation\n- refactor(auth): extract to custom hook`,
        autoFixable: false,
        severity: 'low',
      })
    }
  }

  return issues
}

async function checkTypeScriptStrict(files: string[]): Promise<StyleIssue[]> {
  const issues: StyleIssue[] = []

  // Filter to only TypeScript files
  const tsFiles = files.filter((f) => f.match(/\.tsx?$/))

  if (tsFiles.length === 0) return issues

  try {
    // Run tsc with --noEmit to check for type errors
    execSync(`npx tsc --noEmit`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error: any) {
    // Parse TypeScript errors
    const output = error.stdout || error.stderr
    if (output) {
      const lines = output.split('\n')
      for (const line of lines) {
        const match = line.match(/(.+\.tsx?)\((\d+),\d+\): error TS\d+: (.+)/)
        if (match) {
          const [, file, lineNum, description] = match
          issues.push({
            type: 'TypeScript Error',
            file,
            line: parseInt(lineNum),
            description,
            suggestedFix: 'Fix TypeScript error to comply with strict mode',
            autoFixable: false,
            severity: 'medium',
          })
        }
      }
    }
  }

  return issues
}

function extractFileContent(diff: string, filePath: string): string | null {
  const filePattern = new RegExp(`diff --git a/${filePath} b/${filePath}([\\s\\S]*?)(?=diff --git|$)`)
  const match = diff.match(filePattern)
  if (!match) return null

  // Extract only added lines (lines starting with +)
  const lines = match[1].split('\n')
  const addedLines = lines
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.substring(1))

  return addedLines.join('\n')
}

function convertIssueToComment(issue: StyleIssue): ReviewComment {
  return {
    path: issue.file,
    line: issue.line,
    severity: issue.severity,
    category: 'style',
    body: formatStyleComment(issue),
    suggestion: issue.suggestedFix,
  }
}

function formatStyleComment(issue: StyleIssue): string {
  return `
✨ **Code Style: ${issue.type}**

${issue.autoFixable ? '💡 **Auto-fix available**' : ''}

**Description**:
${issue.description}

**Suggested Fix**:
${issue.suggestedFix}

**References**:
- [KT-Portal Code Style](docs/CLAUDE.md#code-style)
  `.trim()
}

function generateSummary(issues: StyleIssue[]): string {
  const total = issues.length
  const autoFixable = issues.filter((i) => i.autoFixable).length

  if (total === 0) {
    return '✅ No style issues detected'
  }

  return `
✨ **Style Review Summary**

**Total Issues**: ${total}
${autoFixable > 0 ? `- 💡 Auto-fixable: ${autoFixable}` : ''}

${autoFixable > 0 ? 'Run `npx eslint --fix .` to auto-fix ESLint issues.' : ''}
  `.trim()
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: style-agent.ts --pr=<pr-number>')
    process.exit(1)
  }

  // Import and execute
  import('../gh-utils').then(async ({ getPRData, getPRDiff }) => {
    const prData = await getPRData(prNumber)
    const diff = await getPRDiff(prNumber)
    const result = await executeStyleReview(prData, diff)

    console.log(JSON.stringify(result, null, 2))
    process.exit(result.passed ? 0 : 1)
  })
}
