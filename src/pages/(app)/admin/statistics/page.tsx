import { useEffect, useState } from 'react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../admin-console.module.css'

export default function AdminStatisticsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!token) return
    api.adminStatistics(token).then((res) => setStats(res.stats || {})).catch(() => undefined)
  }, [token])

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Thống kê</h1>
          <p>Thống kê người dùng, bài viết, báo cáo, cuộc gọi và hoạt động hệ thống.</p>
        </div>
      </header>
      <section className={styles.grid}>
        <Metric label="Người dùng" value={stats.totalUsers} />
        <Metric label="Bài viết" value={stats.totalPosts} />
        <Metric label="Bình luận" value={stats.totalComments} />
        <Metric label="Tương tác" value={stats.totalReactions} />
        <Metric label="Báo cáo chờ xử lý" value={stats.pendingReports} />
        <Metric label="Báo cáo đã xử lý" value={stats.resolvedReports} />
        <Metric label="Cuộc gọi" value={stats.totalCalls} />
        <Metric label="Hoạt động hệ thống" value={stats.systemActivities} />
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <article className={styles.metric}><span>{label}</span><strong>{Number(value || 0).toLocaleString('vi-VN')}</strong></article>
}
