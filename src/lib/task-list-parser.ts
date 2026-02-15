import { z } from 'zod'

const BULLET_OR_NUMBER_PREFIX =
  /^\s*(?:[-*•●▪◦]|\d{1,3}[.)]|[a-zA-Z][.)])[\s\u00a0\u2000-\u200f\u2028-\u202f\u205f-\u2060\u3000]+/gm

const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export const parsedTaskCandidateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
})

export type ParsedTaskCandidate = z.infer<typeof parsedTaskCandidateSchema>

export const parsedTaskListSchema = z.object({
  tasks: z.array(parsedTaskCandidateSchema).min(1).max(100),
})

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2000-\u200f\u2028-\u202f\u205f-\u2060\u3000]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripLeadingPhrases(input: string): string {
  return input
    .replace(/^following on from .*?,\s*/i, '')
    .replace(/^similar to .*?,\s*/i, '')
    .replace(/^from an seo perspective,\s*/i, '')
    .replace(/^please\s+/i, '')
    .trim()
}

function summarizeTitle(item: string): string {
  const normalized = item.replace(/\s+/g, ' ').trim()
  const stripped = stripLeadingPhrases(normalized)
  const sentenceEndIdx = stripped.search(/[.!?](\s|$)/)

  let title =
    sentenceEndIdx > 20 ? stripped.slice(0, sentenceEndIdx).trim() : stripped

  if (!title) {
    title = normalized
  }

  if (title.length > 120) {
    title = `${title.slice(0, 117).trimEnd()}...`
  }

  return title
}

function inferPriority(item: string): ParsedTaskCandidate['priority'] {
  const normalized = item.toLowerCase()

  const criticalKeywords = [
    'critical',
    'urgent',
    'immediately',
    'asap',
    'blocking',
    'not working',
    'broken',
    'completely white',
    'down',
  ]

  if (criticalKeywords.some((keyword) => normalized.includes(keyword))) {
    return 'critical'
  }

  const highKeywords = [
    'really important',
    'important',
    'looks bad',
    'breaks the display',
    'needs to be fixed',
    'please fix',
    'issue',
    'wrong',
    'doesn\'t work',
    'doesnt work',
  ]

  if (highKeywords.some((keyword) => normalized.includes(keyword))) {
    return 'high'
  }

  const lowKeywords = [
    'if possible',
    'could we',
    'how do you feel',
    'can you tell me',
  ]

  if (lowKeywords.some((keyword) => normalized.includes(keyword))) {
    return 'low'
  }

  return 'medium'
}

function splitListItems(input: string): string[] {
  const text = normalizeWhitespace(input)
  if (!text) return []

  const matches = Array.from(text.matchAll(BULLET_OR_NUMBER_PREFIX))

  if (matches.length > 0) {
    const items: string[] = []

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i]
      const next = matches[i + 1]
      const markerStart = current.index ?? 0
      const contentStart = markerStart + current[0].length
      const contentEnd = next?.index ?? text.length
      const item = text.slice(contentStart, contentEnd).trim()

      if (item) {
        items.push(item)
      }
    }

    if (items.length > 0) {
      return items
    }
  }

  const paragraphSplit = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (paragraphSplit.length > 1) {
    return paragraphSplit
  }

  const lineSplit = text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  if (lineSplit.length > 1) {
    return lineSplit
  }

  return [text]
}

export function parseTaskListFromText(
  input: string,
  maxItems = 100
): ParsedTaskCandidate[] {
  const items = splitListItems(input).slice(0, maxItems)

  const dedupe = new Set<string>()
  const parsed = items
    .map((item) => {
      const normalizedDescription = item.replace(/\s+/g, ' ').trim()
      const description = normalizedDescription
        ? normalizedDescription.length > 10000
          ? `${normalizedDescription.slice(0, 9997).trimEnd()}...`
          : normalizedDescription
        : null

      return parsedTaskCandidateSchema.parse({
        title: summarizeTitle(item),
        description,
        priority: inferPriority(item),
      })
    })
    .filter((task) => {
      const key = `${task.title.toLowerCase()}::${task.description?.toLowerCase() ?? ''}`
      if (dedupe.has(key)) return false
      dedupe.add(key)
      return true
    })

  return parsed
}
