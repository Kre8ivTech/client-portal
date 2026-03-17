'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ArticleFeedback({ articleId, initialCount }: { articleId: string; initialCount: number }) {
  const [submitted, setSubmitted] = useState(false)
  const [helpfulCount, setHelpfulCount] = useState(initialCount || 0)
  const supabase = createClient()

  const handleFeedback = async (helpful: boolean) => {
    if (submitted) return
    setSubmitted(true)
    if (helpful) setHelpfulCount(prev => prev + 1)

    await (supabase as any)
      .from('kb_articles')
      .update({ helpful_count: helpful ? helpfulCount + 1 : helpfulCount })
      .eq('id', articleId)
  }

  if (submitted) {
    return (
      <div className="bg-slate-50 rounded-[32px] p-8 md:p-12 text-center space-y-4 border border-slate-100 shadow-inner">
        <h3 className="text-xl font-bold text-slate-900">Thank you for your feedback!</h3>
        <p className="text-sm text-slate-500 font-medium">{helpfulCount} people found this helpful</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 rounded-[32px] p-8 md:p-12 text-center space-y-6 border border-slate-100 shadow-inner">
      <h3 className="text-xl font-bold text-slate-900">Was this article helpful?</h3>
      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={() => handleFeedback(true)} className="h-14 px-8 rounded-2xl bg-white border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-all gap-2 group">
          <ThumbsUp size={20} className="group-hover:text-blue-600" />
          <span className="font-bold">Yes, it helped!</span>
        </Button>
        <Button variant="outline" onClick={() => handleFeedback(false)} className="h-14 px-8 rounded-2xl bg-white border-slate-200 hover:border-red-600 hover:bg-red-50 transition-all gap-2 group">
          <ThumbsDown size={20} className="group-hover:text-red-600" />
          <span className="font-bold">Not really</span>
        </Button>
      </div>
      <p className="text-sm text-slate-500 font-medium">{helpfulCount} people found this helpful</p>
    </div>
  )
}
