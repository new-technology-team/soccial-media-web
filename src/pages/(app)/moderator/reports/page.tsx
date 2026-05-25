import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import styles from '../../admin/admin-console.module.css'

const REPORT_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
}

export default function ModeratorReportsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('all')
  const [targetType, setTargetType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [nextStatus, setNextStatus] = useState<'IN_REVIEW' | 'RESOLVED' | 'REJECTED'>('IN_REVIEW')
  const [note, setNote] = useState('')

  const load = async () => {
    if (!token) return
    const res = await api.moderationReports(token, status)
    setReports(res.reports)
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [token, status])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return reports.filter((item) => {
      const type = String(item.reportType || item.targetType || '').toLowerCase()
      const okType = targetType === 'all' || type === targetType
      const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q)
      return okType && okKeyword
    })
  }, [keyword, reports, targetType])

  const submit = async () => {
    if (!token || !selected) return
    await api.reviewModerationReport(token, Number(selected.reportId || selected.id), { status: nextStatus, resolutionNote: note })
    toast({ title: 'Thao tác thành công' })
    setSelected(null)
    setNote('')
    await load()
  }

  if (user?.role !== 'admin' && user?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kiểm duyệt viên</p>
          <h1>Báo cáo cần xử lý</h1>
          <p>Xem báo cáo mới, chi tiết báo cáo, đánh dấu đang xử lý, đã xử lý hoặc từ chối.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm báo cáo..." />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(REPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
          <option value="all">Tất cả loại báo cáo</option>
          <option value="post">Bài viết bị báo cáo</option>
          <option value="user">Tài khoản bị báo cáo</option>
          <option value="message">Tin nhắn bị báo cáo</option>
        </select>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Báo cáo</th><th>Đối tượng</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filtered.map((report) => {
              const current = String(report.status || 'PENDING')
              return (
                <tr key={String(report.reportId || report.id)}>
                  <td><b>#{String(report.reportId || report.id)}</b><br /><small>{String(report.reason || report.description || 'Không có mô tả')}</small></td>
                  <td>{String(report.reportType || report.targetType || 'Không rõ')} #{String(report.targetId || '')}</td>
                  <td><span className={`${styles.badge} ${styles[current.toLowerCase()] || ''}`}>{REPORT_LABEL[current] || current}</span></td>
                  <td>{String(report.resolutionNote || 'Không có dữ liệu')}</td>
                  <td><button type="button" className={styles.button} onClick={() => setSelected(report)}>Xử lý</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
      </section>

      <AppDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Xử lý báo cáo"
        description="Ghi rõ lý do xử lý để lưu vào lịch sử vi phạm."
        footer={<><DialogButton variant="secondary" onClick={() => setSelected(null)}>Hủy</DialogButton><DialogButton onClick={() => void submit()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>Trạng thái
            <select className={styles.field} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)}>
              <option value="IN_REVIEW">Đang xem xét</option>
              <option value="RESOLVED">Đã xử lý</option>
              <option value="REJECTED">Đã từ chối</option>
            </select>
          </label>
          <label>Ghi chú xử lý<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú xử lý..." /></label>
        </div>
      </AppDialog>
    </main>
  )
}
