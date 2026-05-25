import { useState } from 'react'

import { useAuthStore } from '@/contexts/auth-store'
import styles from '../admin-console.module.css'

const settings = [
  'Cho phép đăng ký tài khoản mới',
  'Bật kiểm duyệt nội dung tự động',
  'Yêu cầu xác thực OTP',
  'Thông báo khi có báo cáo mới',
  'Lưu nhật ký thao tác quản trị',
]

export default function AdminSettingsPage() {
  const me = useAuthStore((state) => state.user)
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    'Cho phép đăng ký tài khoản mới': true,
    'Bật kiểm duyệt nội dung tự động': true,
    'Yêu cầu xác thực OTP': false,
    'Thông báo khi có báo cáo mới': true,
    'Lưu nhật ký thao tác quản trị': true,
  })

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Cấu hình hệ thống</h1>
          <p>Các tùy chọn hệ thống dành riêng cho quản trị viên.</p>
        </div>
      </header>
      <section className={styles.panel}>
        {settings.map((item) => (
          <div key={item} className={styles.toolbar}>
            <b>{item}</b>
            <button type="button" className={enabled[item] ? styles.button : styles.secondary} onClick={() => setEnabled((prev) => ({ ...prev, [item]: !prev[item] }))}>
              {enabled[item] ? 'Đang bật' : 'Đang tắt'}
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}
