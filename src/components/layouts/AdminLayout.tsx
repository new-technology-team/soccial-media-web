'use client'

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, FileText, Flag, History, LogOut, Settings, Shield, ShieldCheck, Users } from 'lucide-react'

import { useAuthStore } from '@/contexts/auth-store'
import styles from './admin-layout.module.css'

const navItems = [
  { href: '/admin/dashboard', label: 'Tổng quan', icon: BarChart3 },
  { href: '/admin/users', label: 'Quản lý người dùng', icon: Users },
  { href: '/admin/moderators', label: 'Quản lý kiểm duyệt viên', icon: Shield },
  { href: '/admin/reports', label: 'Quản lý báo cáo', icon: Flag },
  { href: '/admin/posts', label: 'Quản lý nội dung', icon: FileText },
  { href: '/admin/statistics', label: 'Thống kê', icon: BarChart3 },
  { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: History },
  { href: '/admin/settings', label: 'Cấu hình hệ thống', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleLogout = () => {
    clearAuth()
    navigate('/auth/admin-login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.badge}>
            <ShieldCheck size={14} /> ADMIN
          </span>
          <strong>ZChat Control Room</strong>
          <p>Không gian vận hành riêng cho quản trị viên.</p>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} to={item.href} className={active ? styles.activeLink : styles.link}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <button type="button" className={styles.logoutButton} onClick={handleLogout}>
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <section className={styles.content}>{children}</section>
    </div>
  )
}
