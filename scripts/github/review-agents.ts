/**
 * Review agent type definitions and registry
 */

import type { ReviewAgent } from './types'

export const REVIEW_AGENTS: Record<string, Omit<ReviewAgent, 'execute'>> = {
  security: {
    name: 'Security Reviewer',
    description: 'Checks for security vulnerabilities, hardcoded secrets, RLS policies, and auth issues',
    checks: [
      'sql-injection',
      'xss',
      'auth-bypass',
      'hardcoded-secrets',
      'rls-policies',
      'service-role-usage',
      'input-validation',
    ],
    severity: 'block',
  },

  performance: {
    name: 'Performance Analyzer',
    description: 'Analyzes query efficiency, bundle size, memory usage, and complexity',
    checks: [
      'n-plus-one-queries',
      'inefficient-queries',
      'bundle-size',
      'memory-leaks',
      'cyclomatic-complexity',
      'react-query-patterns',
    ],
    severity: 'warn',
  },

  style: {
    name: 'Style Checker',
    description: 'Enforces code style, naming conventions, and project standards',
    checks: [
      'eslint-violations',
      'typescript-strict',
      'file-size',
      'naming-conventions',
      'no-emojis',
      'conventional-commits',
    ],
    severity: 'suggest',
  },

  architecture: {
    name: 'Architecture Reviewer',
    description: 'Validates architectural patterns, component organization, and SOLID principles',
    checks: [
      'multi-tenancy-patterns',
      'client-usage',
      'component-organization',
      'coupling-cohesion',
      'solid-principles',
      'server-vs-client-components',
    ],
    severity: 'suggest',
  },
}

/**
 * Get agent configuration by name
 */
export function getAgentConfig(name: string): Omit<ReviewAgent, 'execute'> | undefined {
  return REVIEW_AGENTS[name]
}

/**
 * Get all agent names
 */
export function getAllAgentNames(): string[] {
  return Object.keys(REVIEW_AGENTS)
}

/**
 * Check if agent is required (blocks PR)
 */
export function isRequiredAgent(name: string, config?: any): boolean {
  const requiredAgents = config?.review?.requiredAgents || ['security', 'style']
  return requiredAgents.includes(name)
}

/**
 * Get severity threshold for agent
 */
export function getSeverityThreshold(
  name: string,
  config?: any
): 'block' | 'warn' | 'suggest' {
  return config?.review?.thresholds?.[name] || REVIEW_AGENTS[name]?.severity || 'suggest'
}
