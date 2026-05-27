'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Apple, Chrome, Eye, EyeOff, Lock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { startSocialAuth } from '../social-auth'
import styles from '../auth.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
  })

  useEffect(() => {
    if (searchParams.get('reason') === 'session-expired') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')
      return
    }

    const socialProvider = searchParams.get('socialProvider')
    const socialError = searchParams.get('socialError')
    if (socialError === 'missing-config' && socialProvider) {
      setError(
        `Đăng nhập ${socialProvider === 'google' ? 'Google' : 'Apple'} chưa được cấu hình. Vui lòng thêm OAuth Client ID ở backend.`
      )
      return
    }

    if (socialError === 'callback') {
      setError('Không thể hoàn tất đăng nhập mạng xã hội. Vui lòng thử lại.')
    }
  }, [searchParams])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const payload = await api.login(formData.emailOrPhone.trim(), formData.password)
      setAuth(payload)
      navigate('/feed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email/số điện thoại hoặc mật khẩu không hợp lệ.'
      setError(message)
      if (message.toLowerCase().includes('xác thực')) {
        navigate(`/auth/verify-otp?identifier=${encodeURIComponent(formData.emailOrPhone.trim())}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.loginWrap}>
      <div className={styles.panel}>
        <header>
          <h2 className={styles.heading}>Chào mừng trở lại</h2>
          <p className={styles.subheading}>Đăng nhập để tiếp tục sử dụng tài khoản của bạn</p>
        </header>

        <div className={styles.alertSpace}>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="emailOrPhone">Số điện thoại hoặc Email</label>
            <div className={styles.inputWrap}>
              <Smartphone size={18} className={styles.inputIcon} />
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                placeholder="Nhập số điện thoại hoặc email"
                value={formData.emailOrPhone}
                onChange={handleChange}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Mật khẩu</label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className={styles.eyeBtn}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className={styles.forgot}>
              <Link to="/auth/forgot-password">Quên mật khẩu?</Link>
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className={styles.divider}>
            <span>Hoặc đăng nhập bằng</span>
          </div>

          <div className={styles.socialGrid}>
            <Button
              type="button"
              variant="outline"
              className={styles.socialBtn}
              disabled={isLoading}
              onClick={() => startSocialAuth('google')}
            >
              <Chrome size={17} />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className={styles.socialBtn}
              disabled={isLoading}
              onClick={() => startSocialAuth('apple')}
            >
              <Apple size={17} />
              Apple
            </Button>
          </div>

          <p className={styles.switchText}>
            Chưa có tài khoản? <Link to="/auth/signup">Đăng ký ngay</Link>
          </p>

          <p className={styles.switchTextSecondary}>
            Là quản trị viên? <Link to="/auth/admin-login">Đăng nhập admin</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
