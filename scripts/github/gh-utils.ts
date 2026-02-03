/**
 * GitHub CLI wrapper utilities
 * Provides typed wrappers around gh CLI commands with error handling and caching
 */

import { execSync } from 'child_process'
import type { GitHubPRData, GitHubPRDiff } from './types'

// Simple in-memory cache for PR data
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Execute gh CLI command and return parsed JSON
 */
function execGhCommand(command: string, options?: { skipCache?: boolean }): any {
  const cacheKey = command

  // Check cache first (unless explicitly skipped)
  if (!options?.skipCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
    cache.delete(cacheKey)
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      },
    })

    const parsed = JSON.parse(output.trim())

    // Cache the result
    cache.set(cacheKey, { data: parsed, timestamp: Date.now() })

    return parsed
  } catch (error: any) {
    throw new Error(`GitHub CLI command failed: ${error.message}`)
  }
}

/**
 * Get PR data including files, labels, commits
 */
export async function getPRData(prNumber: number): Promise<GitHubPRData> {
  const fields = [
    'number',
    'title',
    'body',
    'state',
    'author',
    'baseRefName',
    'headRefName',
    'labels',
    'files',
    'commits',
  ].join(',')

  const data = execGhCommand(`gh pr view ${prNumber} --json ${fields}`)
  return data as GitHubPRData
}

/**
 * Get PR diff
 */
export async function getPRDiff(prNumber: number): Promise<string> {
  try {
    const diff = execSync(`gh pr diff ${prNumber}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      },
    })
    return diff
  } catch (error: any) {
    throw new Error(`Failed to get PR diff: ${error.message}`)
  }
}

/**
 * Get PR files with their patches
 */
export async function getPRFiles(prNumber: number): Promise<GitHubPRDiff[]> {
  const diff = await getPRDiff(prNumber)
  const files: GitHubPRDiff[] = []

  // Parse diff into individual file diffs
  const fileDiffs = diff.split('diff --git ')
  for (const fileDiff of fileDiffs) {
    if (!fileDiff.trim()) continue

    const lines = fileDiff.split('\n')
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/)
    if (!headerMatch) continue

    const file = headerMatch[2]
    let additions = 0
    let deletions = 0

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++
      if (line.startsWith('-') && !line.startsWith('---')) deletions++
    }

    files.push({
      file,
      additions,
      deletions,
      patch: fileDiff,
    })
  }

  return files
}

/**
 * Post a review comment on a PR
 */
export async function postReviewComment(
  prNumber: number,
  body: string,
  path?: string,
  line?: number
): Promise<void> {
  try {
    if (path && line) {
      // Inline comment using GitHub API
      execSync(
        `gh api repos/{owner}/{repo}/pulls/${prNumber}/comments -f body="${escapeForShell(body)}" -f path="${path}" -F line=${line}`,
        {
          encoding: 'utf-8',
          stdio: 'inherit',
          env: {
            ...process.env,
            GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
          },
        }
      )
    } else {
      // General comment
      execSync(`gh pr comment ${prNumber} --body "${escapeForShell(body)}"`, {
        encoding: 'utf-8',
        stdio: 'inherit',
        env: {
          ...process.env,
          GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
        },
      })
    }
  } catch (error: any) {
    throw new Error(`Failed to post review comment: ${error.message}`)
  }
}

/**
 * Post a PR review with multiple comments
 */
export async function postPRReview(
  prNumber: number,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  body: string,
  comments?: Array<{ path: string; line: number; body: string }>
): Promise<void> {
  try {
    const reviewData = {
      event,
      body,
      comments: comments?.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    }

    execSync(
      `gh api repos/{owner}/{repo}/pulls/${prNumber}/reviews -f body="${escapeForShell(body)}" -f event="${event}"`,
      {
        encoding: 'utf-8',
        stdio: 'inherit',
        env: {
          ...process.env,
          GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
        },
      }
    )
  } catch (error: any) {
    throw new Error(`Failed to post PR review: ${error.message}`)
  }
}

/**
 * Add labels to a PR
 */
export async function addPRLabels(prNumber: number, labels: string[]): Promise<void> {
  try {
    execSync(`gh pr edit ${prNumber} --add-label "${labels.join(',')}"`, {
      encoding: 'utf-8',
      stdio: 'inherit',
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      },
    })
  } catch (error: any) {
    throw new Error(`Failed to add labels: ${error.message}`)
  }
}

/**
 * Escape string for shell command
 */
function escapeForShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear()
}
