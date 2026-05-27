'use client'

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/contexts/auth-store'
import type { User } from '@/types'
import styles from '../auth.module.css'

const backendCallbackBase = '/backend/api/auth'

const getParamSource = () => {
  const queryParams = new URLSearchParams(window.location.search)
  const hashText = window.location.hash.replace(/^#/, '')
  const hashQuery = hashText.includes('?') ? hashText.slice(hashText.indexOf('?') + 1) : hashText
  const hashParams = new URLSearchParams(hashQuery)
  const merged = new URLSearchParams(hashParams)

  queryParams.forEach((value, key) => merged.set(key, value))
  return merged
}

const getProvider = (params: URLSearchParams) => {
  const state = params.get('state') || ''
  const savedProvider = sessionStorage.getItem('zchat-social-provider') || ''
  if (state.includes('apple') || savedProvider === 'apple') return 'apple'
  return 'google'
}

export default function SocialCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const params = getParamSource()
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    const userText = params.get('user')

    if (accessToken && refreshToken && userText) {
      try {
        const user = JSON.parse(userText) as User
        setAuth({ accessToken, refreshToken, user })
        sessionStorage.removeItem('zchat-social-provider')
        navigate(user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
      } catch {
        navigate('/auth/login?socialError=callback&socialDetail=invalid-payload', { replace: true })
      }
      return
    }

    const code = params.get('code')
    if (code) {
      const provider = getProvider(params)
      const callbackParams = new URLSearchParams({ code })
      const appleUser = params.get('user')
      if (appleUser) callbackParams.set('user', appleUser)
      window.location.replace(`${backendCallbackBase}/${provider}/callback?${callbackParams.toString()}`)
      return
    }

    const idToken = params.get('id_token') || params.get('credential')
    if (idToken) {
      const provider = getProvider(params)
      const callbackParams = new URLSearchParams({ idToken })
      window.location.replace(`${backendCallbackBase}/${provider}/id-token?${callbackParams.toString()}`)
      return
    }

    const error = params.get('error')
    const receivedKeys = [...params.keys()].filter(Boolean).slice(0, 6).join(',')
    const detail = error || (receivedKeys ? `missing-payload:${receivedKeys}` : 'missing-payload:no-query')
    navigate(`/auth/login?socialError=callback&socialDetail=${encodeURIComponent(detail)}`, {
      replace: true,
    })
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
