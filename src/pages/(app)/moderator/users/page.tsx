import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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

type ActionType = 'warn' | 'restrict' | 'temp-lock' | 'restore'

export default function ModeratorUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<{ user: User; type: ActionType; title: string } | null>(null)
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
    else if (action.type === 'restrict') await api.restrictModerationUser(token, action.user.id, reason)
    else if (action.type === 'temp-lock') await api.tempLockModerationUser(token, action.user.id, reason)
    else if (action.type === 'restore') await api.restoreModerationUser(token, action.user.id)
    toast({
      title:
        action.type === 'warn' ? `Đã cảnh cáo "${action.user.fullName}"`
        : action.type === 'restrict' ? `Đã hạn chế tài khoản "${action.user.fullName}"`
        : action.type === 'temp-lock' ? `Đã tạm khóa tài khoản "${action.user.fullName}"`
        : `Đã khôi phục tài khoản "${action.user.fullName}"`,
      description: action.type === 'restore'
        ? 'Tài khoản đã được khôi phục về trạng thái hoạt động bình thường.'
        : 'Hành động kiểm duyệt đã được ghi nhận.',
    })
    setAction(null)
    setReason('')
    await loadUsers()
  }

  const canRestore = (status: string) => status === 'restricted' || status === 'temp_locked' || status === 'warning'

  if (me?.role !== 'admin' && me?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kiểm duyệt viên</p>
          <h1>Quản lý người dùng</h1>
          <p>Xem và xử lý tài khoản vi phạm trong hệ thống. Cảnh cáo, hạn chế, tạm khóa hoặc khôi phục tài khoản.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm tài khoản..." />
        <button type="button" className={styles.secondary} onClick={loadUsers}>Làm mới</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Trạng thái</th>
              <th>Lịch sử vi phạm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.fullName}</b><br />
                  <small>{item.email || item.phone || `ID ${item.id}`}</small>
                </td>
                <td>
                  <span className={`${styles.badge} ${styles[item.accountStatus] || ''}`}>
                    {ACCOUNT_LABEL[item.accountStatus] || item.accountStatus}
                  </span>
                </td>
                <td>
                  {item.warningCount || 0} cảnh cáo<br />
                  <small>{item.restrictionReason || 'Không có ghi chú'}</small>
                </td>
                <td>
                  <div className={styles.actions}>
                    <Link className={styles.secondary} to={`/profile/${item.id}`} target="_blank" rel="noopener noreferrer">Xem hồ sơ</Link>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, type: 'warn', title: 'Cảnh cáo người dùng?' })}>Cảnh cáo</button>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, type: 'restrict', title: 'Hạn chế tài khoản?' })}>Hạn chế</button>
                    <button type="button" className={styles.danger} onClick={() => setAction({ user: item, type: 'temp-lock', title: 'Tạm khóa tài khoản?' })}>Tạm khóa</button>
                    {canRestore(item.accountStatus) ? (
                      <button type="button" className={styles.secondary} onClick={() => setAction({ user: item, type: 'restore', title: 'Khôi phục tài khoản?' })}>Khôi phục</button>
                    ) : null}
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
        description={
          action?.type === 'restore'
            ? 'Khôi phục tài khoản về trạng thái hoạt động bình thường.'
            : 'Vui lòng ghi lý do xử lý để người dùng và quản trị viên có thể tra cứu.'
        }
        footer={
          <>
            <DialogButton variant="secondary" onClick={() => setAction(null)}>Hủy</DialogButton>
            <DialogButton variant="destructive" onClick={() => void submit()}>Xác nhận</DialogButton>
          </>
        }
      >
        <div className={styles.modalForm}>
          {action?.type !== 'restore' ? (
            <label>
              Lý do xử lý
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do xử lý..." />
            </label>
          ) : (
            <p>Tài khoản <strong>{action?.user.fullName}</strong> sẽ được đặt lại về trạng thái hoạt động bình thường và xóa lý do hạn chế.</p>
          )}
        </div>
      </AppDialog>
    </main>
  )
}
