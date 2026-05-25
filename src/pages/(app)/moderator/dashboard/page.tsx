import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../../admin/admin-console.module.css'

export default function ModeratorDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!token) return
    api.moderationDashboard(token).then((res) => setStats(res.stats || {})).catch(() => undefined)
  }, [token])

  if (user?.role !== 'admin' && user?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kiểm duyệt viên</p>
          <h1>Tổng quan kiểm duyệt</h1>
          <p>Không gian xử lý báo cáo, bài viết, tài khoản và tin nhắn vi phạm.</p>
        </div>
      </header>
      <section className={styles.grid}>
        <Metric label="Báo cáo cần xử lý" value={stats.pendingReports} />
        <Metric label="Đang xem xét" value={stats.inReviewReports} />
        <Metric label="Đã xử lý" value={stats.resolvedReports} />
      </section>
      <section className={styles.grid}>
        {[
          ['Báo cáo cần xử lý', '/moderator/reports'],
          ['Bài viết bị báo cáo', '/moderator/posts'],
          ['Tài khoản bị báo cáo', '/moderator/users'],
          ['Tin nhắn bị báo cáo', '/moderator/reports?type=message'],
          ['Lịch sử xử lý vi phạm', '/moderator/reports?status=RESOLVED'],
        ].map(([label, href]) => <Link key={href} className={styles.metric} to={href}><span>{label}</span><strong>→</strong></Link>)}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <article className={styles.metric}><span>{label}</span><strong>{Number(value || 0).toLocaleString('vi-VN')}</strong></article>
}
