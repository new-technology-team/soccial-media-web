import { useEffect, useState } from 'react'

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

export default function AdminModeratorsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [moderators, setModerators] = useState<User[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', password: '', displayName: '' })

  const loadModerators = async () => {
    if (!token) return
    const res = await api.adminModerators(token)
    setModerators(res.moderators)
  }

  useEffect(() => {
    loadModerators().catch(() => undefined)
  }, [token])

  const createModerator = async () => {
    if (!token) return
    if (!form.username.trim() || !form.password.trim()) {
      toast({ title: 'Vui lòng nhập tên đăng nhập và mật khẩu.', variant: 'destructive' })
      return
    }
    await api.createModerator(token, form)
    toast({ title: 'Đã tạo kiểm duyệt viên' })
    setCreateOpen(false)
    setForm({ username: '', password: '', displayName: '' })
    await loadModerators()
  }

  const updateStatus = async (moderator: User, accountStatus: User['accountStatus']) => {
    if (!token) return
    await api.updateModeratorPermissions(token, moderator.id, { role: 'moderator', accountStatus })
    toast({ title: 'Thao tác thành công' })
    await loadModerators()
  }

  const deleteModerator = async () => {
    if (!token || !removeTarget) return
    await api.deleteModerator(token, removeTarget.id)
    toast({ title: 'Đã xóa kiểm duyệt viên' })
    setRemoveTarget(null)
    await loadModerators()
  }

  if (me?.role !== 'admin') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Quản lý kiểm duyệt viên</h1>
          <p>Tạo, khóa, mở khóa, xóa và phân quyền kiểm duyệt viên.</p>
        </div>
        <button type="button" className={styles.button} onClick={() => setCreateOpen(true)}>Tạo kiểm duyệt viên</button>
      </header>

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Kiểm duyệt viên</th><th>Trạng thái</th><th>Quyền</th><th>Thao tác</th></tr></thead>
          <tbody>
            {moderators.map((item) => (
              <tr key={item.id}>
                <td><b>{item.fullName}</b><br /><small>{item.email || item.phone || item.id}</small></td>
                <td><span className={`${styles.badge} ${styles[item.accountStatus] || ''}`}>{ACCOUNT_LABEL[item.accountStatus] || item.accountStatus}</span></td>
                <td>Kiểm duyệt báo cáo, bài viết và người dùng</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => void updateStatus(item, 'active')}>Mở khóa</button>
                    <button type="button" className={styles.secondary} onClick={() => void updateStatus(item, 'locked')}>Khóa</button>
                    <button type="button" className={styles.danger} onClick={() => setRemoveTarget(item)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {moderators.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
      </section>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo kiểm duyệt viên"
        description="Tài khoản mới chỉ có quyền kiểm duyệt, không có quyền quản lý hệ thống."
        footer={<><DialogButton variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</DialogButton><DialogButton onClick={() => void createModerator()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>Tên hiển thị<input className={styles.field} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
          <label>Tên đăng nhập<input className={styles.field} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label>Mật khẩu<input className={styles.field} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        </div>
      </AppDialog>

      <AppDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Xóa kiểm duyệt viên?"
        description="Tài khoản kiểm duyệt viên sẽ bị chuyển sang trạng thái đã xóa."
        footer={<><DialogButton variant="secondary" onClick={() => setRemoveTarget(null)}>Hủy</DialogButton><DialogButton variant="destructive" onClick={() => void deleteModerator()}>Xác nhận</DialogButton></>}
      >
        <p>{removeTarget?.fullName}</p>
      </AppDialog>
    </main>
  )
}
