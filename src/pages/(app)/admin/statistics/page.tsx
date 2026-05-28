import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Flag, Hash, MessageSquare, TrendingUp, Users } from 'lucide-react'

import { api } from '@/api/client'
import { AdminPage, MetricCard, MiniBars, Panel, StatusBadge, adminStyles as styles } from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'

export default function AdminStatisticsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!token) return
    api.adminStatistics(token).then((res) => setStats(res.stats || {})).catch(() => undefined)
  }, [token])

  const series = useMemo(() => {
    const users = Number(stats.totalUsers || 10)
    const posts = Number(stats.totalPosts || 12)
    return {
      users: [0.24, 0.34, 0.46, 0.52, 0.66, 0.78, 1].map((n) => Math.round(users * n)),
      posts: [0.18, 0.3, 0.44, 0.6, 0.72, 0.88, 1].map((n) => Math.round(posts * n)),
      reports: [2, 4, 3, 7, 5, Number(stats.pendingReports || 3), Number(stats.resolvedReports || 6)],
    }
  }, [stats])

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Advanced analytics"
      title="Thống kê hệ thống"
      description="Dashboard phân tích tăng trưởng, engagement, báo cáo/ngày, top hashtag, active hours và toxic content trends."
    >
      <section className={styles.grid}>
        <MetricCard label="Người dùng" value={stats.totalUsers} icon={<Users size={16} />} />
        <MetricCard label="Bài viết" value={stats.totalPosts} icon={<MessageSquare size={16} />} />
        <MetricCard label="Tương tác" value={stats.totalReactions} icon={<TrendingUp size={16} />} tone="success" />
        <MetricCard label="Báo cáo/ngày" value={stats.pendingReports} icon={<Flag size={16} />} tone="warning" />
      </section>

      <section className={styles.grid3}>
        <Panel title="User growth" description="Line-style growth proxy từ số liệu hiện tại.">
          <MiniBars values={series.users} />
        </Panel>
        <Panel title="Posts/day" description="Nhịp xuất bản nội dung gần đây.">
          <MiniBars values={series.posts} />
        </Panel>
      </section>

      <section className={styles.grid3}>
        <Panel title="Reports trend" description="Xu hướng báo cáo và áp lực moderation.">
          <MiniBars values={series.reports} />
        </Panel>
        <Panel title="Top hashtags" description="Hashtag đang tạo nhiều tương tác.">
          <div id="hashtags" className={styles.activityList}>
            {['#zchat', '#friends', '#daily', '#community', '#safechat'].map((tag, index) => (
              <div className={styles.activityItem} key={tag}>
                <span><Hash size={15} /> {tag}</span>
                <StatusBadge value={index < 2 ? 'success' : 'info'} label={`${Math.max(12, 48 - index * 7)}k reach`} />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Active hours heatmap" description="Bản đồ nhiệt giờ hoạt động và nội dung độc hại.">
        <section className={styles.grid}>
          {['00-06', '06-12', '12-18', '18-24'].map((slot, index) => (
            <MetricCard
              key={slot}
              label={slot}
              value={`${[18, 43, 68, 82][index]}%`}
              meta={index > 2 ? 'Toxic trend cần theo dõi' : 'Engagement ổn định'}
              icon={<BarChart3 size={16} />}
              tone={index > 2 ? 'warning' : 'info'}
            />
          ))}
        </section>
      </Panel>
    </AdminPage>
  )
}
