'use client'

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/contexts/auth-store'
import type { User } from '@/types'
import styles from '../auth.module.css'

export default function SocialCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    const userText = params.get('user')

    if (!accessToken || !refreshToken || !userText) {
      navigate('/auth/login?socialError=callback', { replace: true })
      return
    }

    try {
      const user = JSON.parse(userText) as User
      setAuth({ accessToken, refreshToken, user })
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
    } catch {
      navigate('/auth/login?socialError=callback', { replace: true })
    }
  }, [navigate, setAuth])

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Đang đăng nhập</h2>
        <p className={styles.subheading}>Vui lòng chờ trong giây lát...</p>
      </header>
      <div className={styles.alertSpace}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Hệ thống đang hoàn tất đăng nhập mạng xã hội.</AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
