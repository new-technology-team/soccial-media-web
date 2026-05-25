import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../admin-console.module.css'

export default function AdminDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    api.adminDashboard(token)
      .then((res) => setStats(res.stats || {}))
      .catch((err) => setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi'))
      .finally(() => setLoading(false))
  }, [token])

  if (user?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin Dashboard</p>
          <h1>Tổng quan hệ thống</h1>
          <p>Theo dõi người dùng, nội dung, báo cáo và hoạt động quản trị của ZChat.</p>
        </div>
        <Link className={styles.button} to="/admin/reports">Xem báo cáo</Link>
      </header>

      {loading ? <p className={styles.empty}>Đang tải dữ liệu...</p> : null}
      {error ? <p className={styles.empty}>{error}</p> : null}

      <section className={styles.grid}>
        <Metric label="Tổng người dùng" value={stats.totalUsers} />
        <Metric label="Tổng bài viết" value={stats.totalPosts} />
        <Metric label="Báo cáo chờ xử lý" value={stats.pendingReports} />
        <Metric label="Báo cáo đã xử lý" value={stats.resolvedReports} />
        <Metric label="Thống kê cuộc gọi" value={stats.totalCalls} />
        <Metric label="Hoạt động hệ thống" value={stats.systemActivities} />
      </section>

      <section className={styles.grid}>
        {[
          ['Quản lý người dùng', '/admin/users'],
          ['Quản lý kiểm duyệt viên', '/admin/moderators'],
          ['Quản lý báo cáo', '/admin/reports'],
          ['Quản lý nội dung', '/admin/posts'],
          ['Thống kê', '/admin/statistics'],
          ['Nhật ký hệ thống', '/admin/audit-logs'],
          ['Cấu hình hệ thống', '/admin/settings'],
        ].map(([label, href]) => (
          <Link key={href} className={styles.metric} to={href}>
            <span>{label}</span>
            <strong>→</strong>
          </Link>
        ))}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
    </article>
  )
}
