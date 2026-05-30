import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Eye, MoreVertical, ShieldAlert, UserRound, X } from 'lucide-react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from './page.module.css'

const ACCOUNT_LABEL: Record<string, string> = {
  active: 'Dang hoat dong',
  warning: 'Da canh cao',
  restricted: 'Bi han che',
  temp_locked: 'Tam khoa',
  locked: 'Da khoa',
  hidden: 'Da an',
  deleted: 'Da xoa',
}

type ActionType = 'warn' | 'restrict' | 'temp-lock' | 'restore'

export default function ModeratorUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<{ user: User; type: ActionType; title: string } | null>(null)
  const [reason, setReason] = useState('')
  const [actionMenuUserId, setActionMenuUserId] = useState<number | null>(null)
  const [detailUser, setDetailUser] = useState<User | null>(null)

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
        action.type === 'warn' ? `Warned ${action.user.fullName}`
        : action.type === 'restrict' ? `Restricted ${action.user.fullName}`
        : action.type === 'temp-lock' ? `Temporarily locked ${action.user.fullName}`
        : `Restored ${action.user.fullName}`,
      description: 'Moderation action has been recorded.',
    })
    setAction(null)
    setReason('')
    await loadUsers()
  }

  const canRestore = (status: string) => status === 'restricted' || status === 'temp_locked' || status === 'warning'

  if (me?.role !== 'admin' && me?.role !== 'moderator') return <div className={styles.denied}>Ban khong co quyen truy cap.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Moderator Center</p>
          <h1>User moderation</h1>
          <p>Review risky accounts, open a user detail drawer, and apply actions from a compact action menu.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search accounts..." />
        <button type="button" className={styles.secondary} onClick={loadUsers}>Refresh</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Status</th>
              <th>Moderation history</th>
              <th>Actions</th>
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
                  {item.warningCount || 0} warnings<br />
                  <small>{item.restrictionReason || 'No active moderation note'}</small>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => setDetailUser(item)}><Eye size={15} /> Detail</button>
                    <div className={styles.menuWrap}>
                      <button type="button" className={styles.iconButton} onClick={() => setActionMenuUserId((current) => current === item.id ? null : item.id)} aria-label="Open action menu">
                        <MoreVertical size={16} />
                      </button>
                      {actionMenuUserId === item.id ? (
                        <div className={styles.actionMenu}>
                          <Link to={`/profile/${item.id}`} target="_blank" rel="noopener noreferrer">View profile</Link>
                          <button type="button" onClick={() => { setAction({ user: item, type: 'warn', title: 'Warn user?' }); setActionMenuUserId(null) }}>Warn</button>
                          <button type="button" onClick={() => { setAction({ user: item, type: 'restrict', title: 'Restrict account?' }); setActionMenuUserId(null) }}>Restrict</button>
                          <button type="button" className={styles.menuDanger} onClick={() => { setAction({ user: item, type: 'temp-lock', title: 'Temporarily lock account?' }); setActionMenuUserId(null) }}>Temp lock</button>
                          {canRestore(item.accountStatus) ? (
                            <button type="button" onClick={() => { setAction({ user: item, type: 'restore', title: 'Restore account?' }); setActionMenuUserId(null) }}>Restore</button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className={styles.empty}>No users match the current search.</p> : null}
      </section>

      <AppDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.title || ''}
        description={action?.type === 'restore' ? 'Restore this account to normal active status.' : 'Add a moderation note for audit history.'}
        footer={
          <>
            <DialogButton variant="secondary" onClick={() => setAction(null)}>Cancel</DialogButton>
            <DialogButton variant="destructive" onClick={() => void submit()}>Confirm</DialogButton>
          </>
        }
      >
        <div className={styles.modalForm}>
          {action?.type !== 'restore' ? (
            <label>
              Moderation reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Write reason..." />
            </label>
          ) : (
            <p>Account <strong>{action?.user.fullName}</strong> will be restored to normal active status.</p>
          )}
        </div>
      </AppDialog>

      {detailUser ? (
        <aside className={styles.drawerBackdrop} role="presentation" onClick={() => setDetailUser(null)}>
          <section className={styles.drawer} role="dialog" aria-label="User detail" onClick={(event) => event.stopPropagation()}>
            <header className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>User detail</p>
                <h2>{detailUser.fullName}</h2>
              </div>
              <button type="button" onClick={() => setDetailUser(null)} aria-label="Close"><X size={17} /></button>
            </header>
            <div className={styles.userHero}>
              {detailUser.avatarUrl ? <img src={detailUser.avatarUrl} alt={detailUser.fullName} /> : <span>{(detailUser.fullName[0] || 'U').toUpperCase()}</span>}
              <div>
                <b>{detailUser.email || detailUser.phone || `ID ${detailUser.id}`}</b>
                <small>{ACCOUNT_LABEL[detailUser.accountStatus] || detailUser.accountStatus}</small>
              </div>
            </div>
            <div className={styles.historyList}>
              <h3><Clock3 size={16} /> Moderation history</h3>
              <article>
                <ShieldAlert size={15} />
                <span><b>{detailUser.warningCount || 0} warnings</b><small>{detailUser.restrictionReason || 'No current restriction note.'}</small></span>
              </article>
              <article>
                <UserRound size={15} />
                <span><b>Account status</b><small>{ACCOUNT_LABEL[detailUser.accountStatus] || detailUser.accountStatus}</small></span>
              </article>
            </div>
          </section>
        </aside>
      ) : null}
    </main>
  )
}
