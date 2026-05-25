import { useEffect, useState } from 'react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../admin-console.module.css'

export default function AdminAuditLogsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    if (!token) return
    api.adminAuditLogs(token).then((res) => setLogs(res.logs || [])).catch(() => undefined)
  }, [token])

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Nhật ký hệ thống</h1>
          <p>Xem nhật ký đăng nhập, thao tác quản trị và lịch sử thay đổi quyền.</p>
        </div>
      </header>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th><th>Mô tả</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={String(log.auditLogId)}>
                <td>{log.createdAt ? new Date(String(log.createdAt)).toLocaleString('vi-VN') : 'Không rõ'}</td>
                <td>#{String(log.actorId || '')} • {String(log.actorRole || '')}</td>
                <td>{String(log.action || '')}</td>
                <td>{String(log.targetType || '')} #{String(log.targetId || '')}</td>
                <td>{String(log.description || 'Không có dữ liệu')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
      </section>
    </main>
  )
}
