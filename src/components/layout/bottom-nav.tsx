'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Ticket, MessageSquare, FolderKanban, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
]

const moreItems = [
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/contracts', label: 'Contracts' },
  { href: '/dashboard/services', label: 'Services' },
  { href: '/dashboard/kb', label: 'Knowledge Base' },
  { href: '/dashboard/files', label: 'Files' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/profile', label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t">
      <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open navigation menu"
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full text-xs transition-colors cursor-pointer',
                open ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-20">
            <SheetTitle className="text-lg font-semibold mb-4">Navigation</SheetTitle>
            <div className="grid grid-cols-2 gap-3">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith(item.href) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
