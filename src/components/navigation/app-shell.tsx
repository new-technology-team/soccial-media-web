'use client'

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import TopNavbar from '@/components/navigation/top-navbar'
import ModeratorNav from '@/components/navigation/moderator-nav'
import RouteGuard from '@/components/navigation/route-guard'
import { Toaster } from '@/components/ui/toaster'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const hideMainNavbar = pathname.startsWith('/admin') || pathname.startsWith('/moderator') || pathname.startsWith('/auth/admin-login')
  const isModeratorArea = pathname.startsWith('/moderator')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <>
      {!isOnline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#fef3c7', color: '#92400e', padding: '8px 16px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
          Bạn đang offline — kiểm tra kết nối mạng
        </div>
      )}
      {!hideMainNavbar ? <TopNavbar /> : null}
      {isModeratorArea ? (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
          <ModeratorNav />
          <div style={{ flex: 1, minWidth: 0 }}>
            <RouteGuard>{children}</RouteGuard>
          </div>
        </div>
      ) : (
        <main style={!isOnline ? { paddingTop: 36 } : undefined}>
          <RouteGuard>{children}</RouteGuard>
        </main>
      )}
      <Toaster />
    </>
  )
}
