'use client'

import { useLocation } from 'react-router-dom'
import TopNavbar from '@/components/navigation/top-navbar'
import RouteGuard from '@/components/navigation/route-guard'
import { Toaster } from '@/components/ui/toaster'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const hideMainNavbar = pathname.startsWith('/admin') || pathname.startsWith('/auth/admin-login')

  return (
    <>
      {!hideMainNavbar ? <TopNavbar /> : null}
      <main>
        <RouteGuard>{children}</RouteGuard>
      </main>
      <Toaster />
    </>
  )
}
