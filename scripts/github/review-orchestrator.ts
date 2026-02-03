#!/usr/bin/env tsx
/**
 * Review Orchestrator
 * Coordinates execution of all review agents and aggregates results
 */

import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import type { ReviewConfig, AgentReviewResult, ReviewSummary } from './types'
import { getPRData, getPRDiff, addPRLabels } from './gh-utils'
import { executeSecurityReview } from './agents/security-agent'
import { executeStyleReview } from './agents/style-agent'
import { executePerformanceReview } from './agents/performance-agent'
import { executeArchitectureReview } from './agents/architecture-agent'

// Agent executor mapping
const AGENT_EXECUTORS = {
  security: executeSecurityReview,
  style: executeStyleReview,
  performance: executePerformanceReview,
  architecture: executeArchitectureReview,
}

/**
 * Load review configuration from YAML
 */
function loadConfig(): ReviewConfig {
  try {
    const configPath = '.github/review-config/review-swarm.yml'
    const configFile = readFileSync(configPath, 'utf-8')
    return load(configFile) as ReviewConfig
  } catch (error) {
    console.warn('Could not load review config, using defaults')
    return getDefaultConfig()
  }
}

/**
 * Default configuration
 */
function getDefaultConfig(): ReviewConfig {
  return {
    version: 1,
    review: {
      autoTrigger: true,
      requiredAgents: ['security', 'style'],
      optionalAgents: ['performance', 'architecture'],
      thresholds: {
        security: 'block',
        style: 'suggest',
        performance: 'warn',
        architecture: 'suggest',
      },
      rules: {
        security: [],
        performance: [],
        architecture: [],
        style: [],
      },
    },
  }
}

/**
 * Execute all review agents in parallel
 */
export async function orchestrateReview(prNumber: number): Promise<{
  results: AgentReviewResult[]
  summary: ReviewSummary
  recommendation: 'approve' | 'request_changes' | 'comment'
}> {
  console.log(`🚀 Starting review orchestration for PR #${prNumber}`)

  // Load configuration
  const config = loadConfig()

  // Fetch PR data
  console.log('📥 Fetching PR data...')
  const prData = await getPRData(prNumber)
  const diff = await getPRDiff(prNumber)

  console.log(`📋 PR: ${prData.title}`)
  console.log(`📁 Files changed: ${prData.files.length}`)

  // Determine which agents to run
  const agentsToRun = [
    ...config.review.requiredAgents,
    ...config.review.optionalAgents,
  ]

  console.log(`🤖 Running ${agentsToRun.length} agents: ${agentsToRun.join(', ')}`)

  // Execute agents in parallel
  const startTime = Date.now()
  const results = await Promise.all(
    agentsToRun.map(async (agentName) => {
      const executor = AGENT_EXECUTORS[agentName as keyof typeof AGENT_EXECUTORS]
      if (!executor) {
        console.warn(`⚠️  Unknown agent: ${agentName}`)
        return null
      }

      console.log(`▶️  Running ${agentName} agent...`)
      try {
        const result = await executor(prData, diff)
        console.log(`✅ ${agentName} completed in ${result.executionTime}ms`)
        return result
      } catch (error: any) {
        console.error(`❌ ${agentName} failed: ${error.message}`)
        return null
      }
    })
  )

  // Filter out failed agents
  const validResults = results.filter((r): r is AgentReviewResult => r !== null)

  const totalTime = Date.now() - startTime
  console.log(`⏱️  Total review time: ${totalTime}ms`)

  // Generate summary
  const summary = generateSummary(validResults)

  // Determine recommendation
  const recommendation = determineRecommendation(validResults, config)

  // Add labels to PR
  await addLabelsBasedOnResults(prNumber, validResults, recommendation)

  console.log(`📊 Review complete: ${recommendation.toUpperCase()}`)

  return {
    results: validResults,
    summary,
    recommendation,
  }
}

/**
 * Generate aggregate summary
 */
function generateSummary(results: AgentReviewResult[]): ReviewSummary {
  let totalIssues = 0
  let criticalIssues = 0
  let highIssues = 0
  let mediumIssues = 0
  let lowIssues = 0
  let infoIssues = 0
  const byCategory: Record<string, number> = {}

  for (const result of results) {
    for (const comment of result.comments) {
      totalIssues++

      // Count by severity
      switch (comment.severity) {
        case 'critical':
          criticalIssues++
          break
        case 'high':
          highIssues++
          break
        case 'medium':
          mediumIssues++
          break
        case 'low':
          lowIssues++
          break
        case 'info':
          infoIssues++
          break
      }

      // Count by category
      byCategory[comment.category] = (byCategory[comment.category] || 0) + 1
    }
  }

  return {
    totalIssues,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    infoIssues,
    byCategory,
    recommendation: 'comment', // Will be determined later
  }
}

/**
 * Determine PR recommendation based on results and config
 */
function determineRecommendation(
  results: AgentReviewResult[],
  config: ReviewConfig
): 'approve' | 'request_changes' | 'comment' {
  // Check if any required agent failed
  const requiredAgents = config.review.requiredAgents

  for (const result of results) {
    if (!requiredAgents.includes(result.agentName)) continue

    // Check agent-specific thresholds
    const threshold = config.review.thresholds[result.agentName]

    if (threshold === 'block' && !result.passed) {
      return 'request_changes'
    }
  }

  // Check for critical issues from any agent
  const hasCriticalIssues = results.some((r) =>
    r.comments.some((c) => c.severity === 'critical')
  )

  if (hasCriticalIssues) {
    return 'request_changes'
  }

  // Check for high-severity issues
  const hasHighIssues = results.some((r) =>
    r.comments.some((c) => c.severity === 'high')
  )

  if (hasHighIssues) {
    return 'request_changes'
  }

  // If no blocking issues, but has comments
  const hasAnyIssues = results.some((r) => r.comments.length > 0)

  if (hasAnyIssues) {
    return 'comment'
  }

  // All passed, approve
  return 'approve'
}

/**
 * Add labels to PR based on review results
 */
async function addLabelsBasedOnResults(
  prNumber: number,
  results: AgentReviewResult[],
  recommendation: string
): Promise<void> {
  const labels: string[] = []

  // Add labels based on which agents found issues
  for (const result of results) {
    if (result.comments.length > 0) {
      labels.push(`review:${result.agentName}`)
    }
  }

  // Add recommendation label
  if (recommendation === 'request_changes') {
    labels.push('needs-changes')
  } else if (recommendation === 'approve') {
    labels.push('approved-by-ai')
  }

  if (labels.length > 0) {
    try {
      await addPRLabels(prNumber, labels)
      console.log(`🏷️  Added labels: ${labels.join(', ')}`)
    } catch (error: any) {
      console.warn(`⚠️  Could not add labels: ${error.message}`)
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: review-orchestrator.ts --pr=<pr-number>')
    process.exit(1)
  }

  orchestrateReview(prNumber)
    .then((result) => {
      console.log('\n📊 Review Summary:')
      console.log(JSON.stringify(result.summary, null, 2))
      process.exit(result.recommendation === 'request_changes' ? 1 : 0)
    })
    .catch((error) => {
      console.error('❌ Review orchestration failed:', error)
      process.exit(1)
    })
}
