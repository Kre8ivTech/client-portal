import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut, Home, Ticket, FileText, Settings, Users } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile-first Sidebar (Desktop only for now) */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight">KT-Portal</h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Client Portal v2</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <NavItem href="/dashboard" icon={<Home size={20} />} label="Overview" active />
          <NavItem href="/dashboard/tickets" icon={<Ticket size={20} />} label="Tickets" />
          <NavItem href="/dashboard/invoices" icon={<FileText size={20} />} label="Invoices" />
          <NavItem href="/dashboard/clients" icon={<Users size={20} />} label="Clients" />
          <NavItem href="/dashboard/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <form action="/auth/signout" method="post">
            <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 gap-3" type="submit">
              <LogOut size={20} />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        <header className="h-16 border-b bg-white flex items-center justify-between px-8 shadow-sm">
          <h1 className="font-semibold text-lg">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user.email}</span>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              {user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        
        <main className="p-8 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function NavItem({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active 
          ? 'bg-primary text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  )
}
