/**
 * Review Comment Generator
 * Generates formatted review comments and summaries
 */

import type { ReviewComment, ReviewSummary, AgentReviewResult } from './types'

/**
 * Generate summary comment for PR
 */
export function generateSummaryComment(
  results: AgentReviewResult[],
  summary: ReviewSummary,
  recommendation: 'approve' | 'request_changes' | 'comment'
): string {
  const icon = {
    approve: '✅',
    request_changes: '⚠️',
    comment: '💬',
  }[recommendation]

  const status = {
    approve: 'APPROVED',
    request_changes: 'CHANGES REQUESTED',
    comment: 'COMMENTED',
  }[recommendation]

  return `
${icon} **Code Review Swarm - ${status}**

## Summary

${generateSummaryStats(summary)}

${generateAgentReports(results)}

${generateRecommendation(recommendation, summary)}

---

<sub>🤖 Automated code review powered by AI agents | [Review Config](.github/review-config/review-swarm.yml)</sub>
  `.trim()
}

function generateSummaryStats(summary: ReviewSummary): string {
  const { totalIssues, criticalIssues, highIssues, mediumIssues, lowIssues } = summary

  if (totalIssues === 0) {
    return '✨ **No issues detected** - Great work!'
  }

  return `
**Total Issues**: ${totalIssues}
${criticalIssues > 0 ? `- 🔴 Critical: ${criticalIssues}` : ''}
${highIssues > 0 ? `- 🟠 High: ${highIssues}` : ''}
${mediumIssues > 0 ? `- 🟡 Medium: ${mediumIssues}` : ''}
${lowIssues > 0 ? `- 🟢 Low: ${lowIssues}` : ''}

**By Category**:
${Object.entries(summary.byCategory)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}
  `.trim()
}

function generateAgentReports(results: AgentReviewResult[]): string {
  return `
## Agent Reports

${results
  .map((result) => {
    const icon = result.passed ? '✅' : '❌'
    const issueCount = result.comments.length

    return `
### ${icon} ${result.agentName}
${result.summary}
${issueCount > 0 ? `\n📋 **${issueCount} issue(s) found** - See inline comments` : ''}
    `.trim()
  })
  .join('\n\n')}
  `.trim()
}

function generateRecommendation(
  recommendation: string,
  summary: ReviewSummary
): string {
  if (recommendation === 'approve') {
    return `
## ✅ Recommendation: APPROVE

All review checks passed! This PR is ready to merge.
    `.trim()
  }

  if (recommendation === 'request_changes') {
    const criticalCount = summary.criticalIssues
    const highCount = summary.highIssues

    return `
## ⚠️ Recommendation: REQUEST CHANGES

This PR has ${criticalCount + highCount} blocking issue(s) that must be addressed:
${criticalCount > 0 ? `- ${criticalCount} critical severity` : ''}
${highCount > 0 ? `- ${highCount} high severity` : ''}

Please review the inline comments and make the necessary changes before merging.
    `.trim()
  }

  return `
## 💬 Recommendation: COMMENT

This PR has ${summary.totalIssues} suggestion(s) to improve code quality. Please review the inline comments.

These are non-blocking recommendations, but addressing them will improve maintainability.
  `.trim()
}

/**
 * Generate inline comment body
 */
export function generateInlineComment(comment: ReviewComment): string {
  return comment.body
}

/**
 * Group comments by file for batch posting
 */
export function groupCommentsByFile(
  comments: ReviewComment[]
): Map<string, ReviewComment[]> {
  const grouped = new Map<string, ReviewComment[]>()

  for (const comment of comments) {
    const existing = grouped.get(comment.path) || []
    existing.push(comment)
    grouped.set(comment.path, existing)
  }

  return grouped
}

/**
 * Sort comments by severity (critical first)
 */
export function sortCommentsBySeverity(comments: ReviewComment[]): ReviewComment[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

  return [...comments].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Limit comments to avoid spamming (GitHub has max 250 comments per review)
 */
export function limitComments(
  comments: ReviewComment[],
  maxComments: number = 200
): { comments: ReviewComment[]; truncated: number } {
  if (comments.length <= maxComments) {
    return { comments, truncated: 0 }
  }

  // Prioritize by severity
  const sorted = sortCommentsBySeverity(comments)
  const limited = sorted.slice(0, maxComments)
  const truncated = sorted.length - maxComments

  return { comments: limited, truncated }
}

/**
 * Generate a comment indicating truncation
 */
export function generateTruncationComment(truncatedCount: number): string {
  return `
⚠️ **Note**: ${truncatedCount} additional issue(s) were found but not shown to avoid comment spam.

Please run the review agents locally to see all issues:
\`\`\`bash
npm run review:all
\`\`\`
  `.trim()
}
