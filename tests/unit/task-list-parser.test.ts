import { describe, it, expect } from 'vitest'
import { parseTaskListFromText } from '@/lib/task-list-parser'

describe('parseTaskListFromText', () => {
  it('splits numbered lists into individual task candidates', () => {
    const input = [
      '1. Fix product card spacing issue on internal shop pages.',
      '2. Make search input focus behavior match contact form.',
      '3. Align checkout form input behavior with contact form.',
    ].join('\n')

    const tasks = parseTaskListFromText(input)

    expect(tasks).toHaveLength(3)
    expect(tasks[0].title.toLowerCase()).toContain('fix product card spacing')
    expect(tasks[1].title.toLowerCase()).toContain('search input focus behavior')
  })

  it('handles lists that contain unusual unicode spacing characters', () => {
    const input =
      ' 1.⁠ ⁠Fix spacing above pricing row on product cards\n 2.⁠ ⁠Search function does not work on mobile'

    const tasks = parseTaskListFromText(input)

    expect(tasks).toHaveLength(2)
    expect(tasks[0].title).toContain('Fix spacing above pricing row')
    expect(tasks[1].description?.toLowerCase()).toContain('mobile')
  })

  it('falls back to paragraph splitting when no markers are present', () => {
    const input = [
      'Update the cart page remove icons to match the blue theme.',
      '',
      'Restore the view all categories button in the homepage category section.',
    ].join('\n')

    const tasks = parseTaskListFromText(input)

    expect(tasks).toHaveLength(2)
  })

  it('infers priority keywords for urgent and low-priority language', () => {
    const input = [
      '1. Critical checkout flow is broken and not working.',
      '2. If possible, add logos to the brands menu labels.',
    ].join('\n')

    const tasks = parseTaskListFromText(input)

    expect(tasks[0].priority).toBe('critical')
    expect(tasks[1].priority).toBe('low')
  })
})
