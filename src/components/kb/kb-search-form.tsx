'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

export function KBSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/dashboard/kb?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/dashboard/kb')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for articles, guides, and more..."
        className="w-full h-16 pl-12 pr-32 rounded-2xl border border-slate-200 bg-white shadow-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
      />
      <Button
        type="submit"
        className="absolute right-2 top-2 h-12 px-8 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
      >
        Search
      </Button>
    </form>
  )
}
