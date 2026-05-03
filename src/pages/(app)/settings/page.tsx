'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Shield, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import styles from './page.module.css'

type Settings = {
  privacyLastSeen: boolean
  privacyProfilePhoto: boolean
  allowFriendRequests: boolean
  notificationMessages: boolean
  notificationCalls: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeSection, setActiveSection] = useState<'security' | 'privacy' | 'access'>('security')
  const [settings, setSettings] = useState<Settings>({
    privacyLastSeen: false,
    privacyProfilePhoto: false,
    allowFriendRequests: true,
    notificationMessages: true,
    notificationCalls: true,
  })
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' })

  useEffect(() => {
    if (!token) {
      navigate('/auth/login')
      return
    }

    loadSettings()
  }, [token, navigate])

  const loadSettings = async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await api.getSettings(token)
      setSettings(response.settings)
    } catch (err) {
      console.error('Failed to load settings', err)
      setError('Không thể tải cài đặt')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (passwordForm.new !== passwordForm.confirm) {
      setError('Mật khẩu mới không khớp')
      return
    }
    if (passwordForm.new.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(token, {
        oldPassword: passwordForm.old,
        newPassword: passwordForm.new,
      })
      setSuccess('Đã đổi mật khẩu thành công')
      setPasswordForm({ old: '', new: '', confirm: '' })
      setShowChangePassword(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!token) return
    setSaving(true)
    try {
      const response = await api.saveSettings(token, settings)
      setSettings(response.settings)
      setSuccess('Đã cập nhật cài đặt thành công')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cài đặt')
    } finally {
      setSaving(false)
    }
  }

  if (!token || loading) {
    return <div className={styles.page}><p>Đang tải...</p></div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Bảo mật và quyền riêng tư</h1>
        <p>Quản lý khả năng hiển thị hồ sơ, mật khẩu và các tài khoản bị chặn.</p>
      </header>

      {error && <div style={{ color: 'red', padding: '1rem', margin: '1rem 0' }}>{error}</div>}
      {success && <div style={{ color: 'green', padding: '1rem', margin: '1rem 0' }}>{success}</div>}

      <div className={styles.layout}>
        <aside className={styles.menu}>
          <button 
            type="button" 
            className={activeSection === 'security' ? styles.menuActive : ''}
            onClick={() => setActiveSection('security')}
          >
            <Shield size={16} /> Trung tâm bảo mật
          </button>
          <button 
            type="button"
            className={activeSection === 'privacy' ? styles.menuActive : ''}
            onClick={() => setActiveSection('privacy')}
          >
            <Users size={16} /> Chính sách quyền riêng tư
          </button>
        </aside>

        <section className={styles.content}>
          {activeSection === 'security' && (
            <>
              <article className={styles.card}>
                <h3>Mật khẩu</h3>
                <p>Đã cập nhật gần đây. Nên đổi mật khẩu định kỳ 6 tháng/lần.</p>
                <button 
                  type="button" 
                  className={styles.softBtn}
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  {showChangePassword ? 'Hủy' : 'Cập nhật mật khẩu'}
                </button>
                
                {showChangePassword && (
                  <form onSubmit={handleChangePassword} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>Mật khẩu hiện tại</label>
                      <input
                        type="password"
                        value={passwordForm.old}
                        onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>Mật khẩu mới</label>
                      <input
                        type="password"
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>Xác nhận mật khẩu mới</label>
                      <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <button type="submit" disabled={saving} className={styles.saveBtn}>
                      {saving ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                    </button>
                  </form>
                )}
              </article>
            </>
          )}

          {activeSection === 'privacy' && (
            <>
              <article className={styles.card}>
                <h2>Cài đặt quyền riêng tư</h2>
                <p>Kiểm soát ai có thể xem thông tin của bạn.</p>
                
                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.privacyLastSeen}
                      onChange={(e) => setSettings({ ...settings, privacyLastSeen: e.target.checked })}
                    />
                    <span>
                      <b>Ẩn trạng thái 'Online'</b>
                      <small>Người khác không thể biết bạn đang online hay không</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.privacyProfilePhoto}
                      onChange={(e) => setSettings({ ...settings, privacyProfilePhoto: e.target.checked })}
                    />
                    <span>
                      <b>Ẩn ảnh hồ sơ</b>
                      <small>Chỉ bạn bè mới có thể thấy ảnh hồ sơ của bạn</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.allowFriendRequests}
                      onChange={(e) => setSettings({ ...settings, allowFriendRequests: e.target.checked })}
                    />
                    <span>
                      <b>Cho phép lời mời kết bạn</b>
                      <small>Cho phép mọi người gửi lời mời kết bạn</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.notificationMessages}
                      onChange={(e) => setSettings({ ...settings, notificationMessages: e.target.checked })}
                    />
                    <span>
                      <b>Thông báo tin nhắn</b>
                      <small>Nhận thông báo khi có tin nhắn mới</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.notificationCalls}
                      onChange={(e) => setSettings({ ...settings, notificationCalls: e.target.checked })}
                    />
                    <span>
                      <b>Thông báo cuộc gọi</b>
                      <small>Nhận thông báo khi có cuộc gọi đến</small>
                    </span>
                  </label>
                </div>
              </article>
            </>
          )}

          <div className={styles.footerActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => loadSettings()}>
              Hủy thay đổi
            </button>
            <button 
              type="button" 
              className={styles.saveBtn}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
