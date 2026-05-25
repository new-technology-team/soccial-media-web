import { useEffect, useState } from 'react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from '../admin-console.module.css'

const REPORT_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
}

export default function AdminReportsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [moderators, setModerators] = useState<User[]>([])
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [assignedTo, setAssignedTo] = useState('')

  const load = async () => {
    if (!token) return
    const [reportRes, moderatorRes] = await Promise.all([api.adminReports(token, status), api.adminModerators(token)])
    setReports(reportRes.reports)
    setModerators(moderatorRes.moderators)
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [token, status])

  const assign = async () => {
    if (!token || !selected) return
    await api.assignAdminReport(token, Number(selected.reportId || selected.id), assignedTo ? Number(assignedTo) : null)
    toast({ title: 'Đã phân công báo cáo' })
    setSelected(null)
    await load()
  }

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Quản lý báo cáo</h1>
          <p>Xem tất cả báo cáo, phân công cho kiểm duyệt viên và theo dõi lịch sử xử lý.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả báo cáo</option>
          {Object.entries(REPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className={styles.secondary} onClick={load}>Làm mới</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Báo cáo</th><th>Đối tượng</th><th>Trạng thái</th><th>Phân công</th><th>Thao tác</th></tr></thead>
          <tbody>
            {reports.map((report) => {
              const currentStatus = String(report.status || 'PENDING')
              return (
                <tr key={String(report.reportId || report.id)}>
                  <td><b>#{String(report.reportId || report.id)}</b><br /><small>{String(report.reason || report.description || 'Không có mô tả')}</small></td>
                  <td>{String(report.reportType || report.targetType || 'Không rõ')} #{String(report.targetId || '')}</td>
                  <td><span className={`${styles.badge} ${styles[currentStatus.toLowerCase()] || ''}`}>{REPORT_LABEL[currentStatus] || currentStatus}</span></td>
                  <td>{report.assignedTo ? `#${report.assignedTo}` : 'Chưa phân công'}</td>
                  <td><button type="button" className={styles.button} onClick={() => setSelected(report)}>Phân công</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {reports.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
      </section>

      <AppDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Phân công báo cáo"
        description="Báo cáo sẽ chuyển sang trạng thái đang xem xét."
        footer={<><DialogButton variant="secondary" onClick={() => setSelected(null)}>Hủy</DialogButton><DialogButton onClick={() => void assign()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>Kiểm duyệt viên
            <select className={styles.field} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Chưa phân công</option>
              {moderators.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
        </div>
      </AppDialog>
    </main>
  )
}
