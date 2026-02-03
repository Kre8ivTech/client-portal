#!/usr/bin/env tsx
/**
 * Post Review Results
 * Posts review summary and inline comments to GitHub PR
 */

import { postPRReview, postReviewComment } from './gh-utils'
import { orchestrateReview } from './review-orchestrator'
import {
  generateSummaryComment,
  generateInlineComment,
  groupCommentsByFile,
  limitComments,
  generateTruncationComment,
} from './comment-generator'

const MAX_INLINE_COMMENTS = 200 // GitHub limit is 250, leave buffer

/**
 * Post complete review to PR
 */
export async function postReview(prNumber: number): Promise<void> {
  console.log(`📝 Posting review for PR #${prNumber}`)

  // Run review orchestration
  const { results, summary, recommendation } = await orchestrateReview(prNumber)

  // Collect all comments
  const allComments = results.flatMap((r) => r.comments)

  // Limit comments to avoid spam
  const { comments: limitedComments, truncated } = limitComments(
    allComments,
    MAX_INLINE_COMMENTS
  )

  console.log(`💬 Posting ${limitedComments.length} inline comment(s)`)

  // Group comments by file
  const groupedComments = groupCommentsByFile(limitedComments)

  // Post inline comments in batches
  for (const [file, fileComments] of groupedComments.entries()) {
    console.log(`📄 Posting ${fileComments.length} comment(s) for ${file}`)

    for (const comment of fileComments) {
      try {
        await postReviewComment(
          prNumber,
          generateInlineComment(comment),
          comment.path,
          comment.line
        )
      } catch (error: any) {
        console.warn(`⚠️  Failed to post comment for ${file}:${comment.line}: ${error.message}`)
      }
    }
  }

  // Generate summary comment
  const summaryBody = generateSummaryComment(results, summary, recommendation)

  // Add truncation notice if needed
  const finalSummary =
    truncated > 0
      ? `${summaryBody}\n\n${generateTruncationComment(truncated)}`
      : summaryBody

  // Post PR review with summary
  const event = {
    approve: 'APPROVE' as const,
    request_changes: 'REQUEST_CHANGES' as const,
    comment: 'COMMENT' as const,
  }[recommendation]

  console.log(`📊 Posting summary with event: ${event}`)

  try {
    await postPRReview(prNumber, event, finalSummary)
    console.log('✅ Review posted successfully')
  } catch (error: any) {
    console.error(`❌ Failed to post review: ${error.message}`)
    throw error
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const prNumber = parseInt(args.find((arg) => arg.startsWith('--pr='))?.split('=')[1] || '0')

  if (!prNumber) {
    console.error('Usage: post-review.ts --pr=<pr-number>')
    process.exit(1)
  }

  postReview(prNumber)
    .then(() => {
      console.log('✅ Review posting complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Review posting failed:', error)
      process.exit(1)
    })
}
