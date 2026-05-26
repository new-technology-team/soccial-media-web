'use client'

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '@/components/navigation/navbar'
import RouteGuard from '@/components/navigation/route-guard'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const hideMainNavbar = pathname.startsWith('/admin') || pathname.startsWith('/auth/admin-login')
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
      {!hideMainNavbar ? <Navbar /> : null}
      <main style={!isOnline ? { paddingTop: 36 } : undefined}>
        <RouteGuard>{children}</RouteGuard>
      </main>
    </>
  )
}
