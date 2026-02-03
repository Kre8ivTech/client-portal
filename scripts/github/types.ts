/**
 * TypeScript types for GitHub CLI and API integration
 */

export interface GitHubPRData {
  number: number
  title: string
  body: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  author: {
    login: string
  }
  baseRefName: string
  headRefName: string
  labels: Array<{
    name: string
  }>
  files: Array<{
    path: string
    additions: number
    deletions: number
  }>
  commits: Array<{
    oid: string
    messageHeadline: string
  }>
}

export interface GitHubPRDiff {
  file: string
  additions: number
  deletions: number
  patch: string
}

export interface ReviewComment {
  path: string
  line: number
  body: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'security' | 'performance' | 'style' | 'architecture' | 'maintainability'
  suggestion?: string
  references?: string[]
}

export interface ReviewSummary {
  totalIssues: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  infoIssues: number
  byCategory: Record<string, number>
  recommendation: 'approve' | 'request_changes' | 'comment'
}

export interface AgentReviewResult {
  agentName: string
  comments: ReviewComment[]
  summary: string
  passed: boolean
  executionTime: number
}

export interface SecurityIssue {
  type: string
  file: string
  line: number
  description: string
  impact: string
  suggestedFix: string
  owaspLink?: string
  severity: ReviewComment['severity']
}

export interface PerformanceIssue {
  type: string
  file: string
  line: number
  description: string
  impact: string
  suggestedFix: string
  severity: ReviewComment['severity']
  metrics?: {
    complexity?: number
    bundleSizeImpact?: number
  }
}

export interface StyleIssue {
  type: string
  file: string
  line: number
  description: string
  suggestedFix: string
  autoFixable: boolean
  severity: ReviewComment['severity']
}

export interface ArchitectureIssue {
  type: string
  file: string
  line?: number
  description: string
  impact: string
  suggestedFix: string
  severity: ReviewComment['severity']
  metrics?: {
    coupling?: number
    cohesion?: number
    complexity?: number
  }
}

export interface ReviewConfig {
  version: number
  review: {
    autoTrigger: boolean
    requiredAgents: string[]
    optionalAgents: string[]
    thresholds: Record<string, 'block' | 'warn' | 'suggest'>
    rules: {
      security: string[]
      performance: string[]
      architecture: string[]
      style: string[]
    }
  }
}

export interface ReviewAgent {
  name: string
  description: string
  checks: string[]
  severity: 'block' | 'warn' | 'suggest'
  execute: (prData: GitHubPRData, diff: string) => Promise<AgentReviewResult>
}
