import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from '../../admin/admin-console.module.css'

const ACCOUNT_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  warning: 'Đã cảnh cáo',
  restricted: 'Bị hạn chế',
  temp_locked: 'Tạm khóa',
  locked: 'Đã khóa',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

export default function ModeratorUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<{ user: User; type: 'warn' | 'restrict' | 'temp-lock'; title: string } | null>(null)
  const [reason, setReason] = useState('')

  const loadUsers = async () => {
    if (!token) return
    const res = await api.moderationUsers(token)
    setUsers(res.users.filter((item) => item.role !== 'admin'))
  }

  useEffect(() => {
    loadUsers().catch(() => undefined)
  }, [token])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return users.filter((item) => !q || [item.fullName, item.email, item.phone, item.id].join(' ').toLowerCase().includes(q))
  }, [keyword, users])

  const submit = async () => {
    if (!token || !action) return
    if (action.type === 'warn') await api.warnModerationUser(token, action.user.id, reason)
    if (action.type === 'restrict') await api.restrictModerationUser(token, action.user.id, reason)
    if (action.type === 'temp-lock') await api.tempLockModerationUser(token, action.user.id, reason)
    toast({ title: 'Thao tác thành công' })
    setAction(null)
    setReason('')
    await loadUsers()
  }

  if (me?.role !== 'admin' && me?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kiểm duyệt viên</p>
          <h1>Tài khoản bị báo cáo</h1>
          <p>Cảnh cáo người dùng, hạn chế tài khoản, tạm khóa tài khoản và xem lịch sử vi phạm.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm tài khoản..." />
        <button type="button" className={styles.secondary} onClick={loadUsers}>Làm mới</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Tài khoản</th><th>Trạng thái</th><th>Lịch sử vi phạm</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td><b>{item.fullName}</b><br /><small>{item.email || item.phone || `ID ${item.id}`}</small></td>
                <td><span className={`${styles.badge} ${styles[item.accountStatus] || ''}`}>{ACCOUNT_LABEL[item.accountStatus] || item.accountStatus}</span></td>
                <td>{item.warningCount || 0} cảnh cáo<br /><small>{item.restrictionReason || 'Không có dữ liệu'}</small></td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, type: 'warn', title: 'Cảnh cáo người dùng?' })}>Cảnh cáo</button>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, type: 'restrict', title: 'Hạn chế tài khoản?' })}>Hạn chế</button>
                    <button type="button" className={styles.danger} onClick={() => setAction({ user: item, type: 'temp-lock', title: 'Tạm khóa tài khoản?' })}>Tạm khóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
      </section>

      <AppDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.title || ''}
        description="Vui lòng ghi lý do xử lý để người dùng và quản trị viên có thể tra cứu."
        footer={<><DialogButton variant="secondary" onClick={() => setAction(null)}>Hủy</DialogButton><DialogButton variant="destructive" onClick={() => void submit()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>Lý do xử lý<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do xử lý..." /></label>
        </div>
      </AppDialog>
    </main>
  )
}
