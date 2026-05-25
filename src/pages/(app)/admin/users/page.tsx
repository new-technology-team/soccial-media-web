import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from '../admin-console.module.css'

const ACCOUNT_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  warning: 'Đã cảnh cáo',
  restricted: 'Bị hạn chế',
  temp_locked: 'Tạm khóa',
  locked: 'Đã khóa',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Kiểm duyệt viên',
  user: 'Người dùng',
}

export default function AdminUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<{ user: User; status?: User['accountStatus']; delete?: boolean; title: string } | null>(null)
  const [reason, setReason] = useState('')

  const loadUsers = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.moderationUsers(token)
      setUsers(res.users)
    } catch (error) {
      toast({ title: 'Đã xảy ra lỗi', description: error instanceof Error ? error.message : 'Không thể tải dữ liệu.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers().catch(() => undefined)
  }, [token])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return users.filter((item) => {
      const okStatus = status === 'all' || item.accountStatus === status
      const okKeyword = !q || [item.fullName, item.email, item.phone, item.id].join(' ').toLowerCase().includes(q)
      return okStatus && okKeyword
    })
  }, [keyword, status, users])

  const submitAction = async () => {
    if (!token || !action) return
    if (action.delete) {
      await api.deleteAdminUser(token, action.user.id)
    } else if (action.status) {
      await api.updateModerationUser(token, action.user.id, { accountStatus: action.status, reason, restrictionReason: reason })
    }
    toast({ title: 'Thao tác thành công' })
    setAction(null)
    setReason('')
    await loadUsers()
  }

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Quản lý người dùng</h1>
          <p>Xem danh sách, tìm kiếm, lọc trạng thái, khóa, mở khóa, xóa tài khoản và xem lịch sử vi phạm.</p>
        </div>
      </header>

      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm người dùng..." />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(ACCOUNT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className={styles.secondary} onClick={loadUsers}>Làm mới</button>
      </section>

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Lịch sử vi phạm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td><b>{item.fullName}</b><br /><small>{item.email || item.phone || `ID ${item.id}`}</small></td>
                <td>{ROLE_LABEL[item.role] || item.role}</td>
                <td><span className={`${styles.badge} ${styles[item.accountStatus] || ''}`}>{ACCOUNT_LABEL[item.accountStatus] || item.accountStatus}</span></td>
                <td>{item.warningCount || 0} cảnh cáo<br /><small>{item.restrictionReason || 'Không có dữ liệu'}</small></td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, status: 'active', title: 'Mở khóa tài khoản?' })}>Mở khóa</button>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, status: 'locked', title: 'Khóa tài khoản?' })}>Khóa</button>
                    <button type="button" className={styles.danger} disabled={item.id === me.id} onClick={() => setAction({ user: item, delete: true, title: 'Xóa tài khoản?' })}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
        {loading ? <p className={styles.empty}>Đang tải dữ liệu...</p> : null}
      </section>

      <AppDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.title || ''}
        description="Hành động này sẽ được ghi vào nhật ký hệ thống."
        footer={<><DialogButton variant="secondary" onClick={() => setAction(null)}>Hủy</DialogButton><DialogButton variant="destructive" onClick={() => void submitAction()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>
            Lý do xử lý
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do xử lý..." />
          </label>
        </div>
      </AppDialog>
    </main>
  )
}
