'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Phone,
  Search,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import type { NotificationItem } from '@/types'
import styles from './page.module.css'

type Category = 'all' | 'messages' | 'calls' | 'social' | 'system'
type ReadFilter = 'all' | 'unread' | 'read' | 'today' | 'yesterday' | 'week' | 'month'
type SortMode = 'newest' | 'oldest'

const categoryMeta: Record<Category, { label: string; color: string }> = {
  all: { label: 'Tất cả', color: '#22c55e' },
  messages: { label: 'Tin nhắn', color: '#2563eb' },
  calls: { label: 'Cuộc gọi', color: '#22c55e' },
  social: { label: 'Xã hội', color: '#ec4899' },
  system: { label: 'Hệ thống', color: '#f97316' },
}

const getCategory = (type: string): Exclude<Category, 'all'> => {
  if (['message', 'mention', 'reply', 'reaction', 'message_recalled', 'group_invitation'].includes(type)) return 'messages'
  if (['call', 'call_missed', 'incoming_call', 'video_call', 'group_call'].includes(type)) return 'calls'
  if (['like', 'comment', 'share', 'follow', 'friend-request', 'friend-accepted', 'post_mention'].includes(type)) return 'social'
  return 'system'
}

const iconForNotification = (item: NotificationItem) => {
  const category = getCategory(item.type)
  if (category === 'messages') return MessageCircle
  if (category === 'calls') return item.type.includes('video') ? Video : Phone
  if (category === 'social') return item.type.includes('friend') || item.type === 'follow' ? UserPlus : Heart
  return item.type.includes('security') ? Shield : Bell
}

const parseMeta = (item: NotificationItem): Record<string, unknown> => {
  const source = item.meta ?? item.meta_json
  if (!source) return {}
  try {
    return typeof source === 'string' ? JSON.parse(source) : source
  } catch {
    return {}
  }
}

const timeAgo = (value: string) => {
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return value
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(value).toLocaleString('vi-VN')
}

const isInDateFilter = (item: NotificationItem, filter: ReadFilter) => {
  if (filter === 'unread') return !item.is_read
  if (filter === 'read') return Boolean(item.is_read)
  if (filter === 'all') return true
  const created = new Date(item.created_at)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const createdTime = created.getTime()
  if (filter === 'today') return createdTime >= startToday
  if (filter === 'yesterday') return createdTime >= startToday - 86400000 && createdTime < startToday
  if (filter === 'week') return createdTime >= Date.now() - 7 * 86400000
  return createdTime >= Date.now() - 31 * 86400000
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [busyId, setBusyId] = useState<number | string | null>(null)

  const loadNotifications = async () => {
    if (!token) return
    const response = await api.notifications(token)
    setNotifications(response.notifications)
  }

  useEffect(() => {
    loadNotifications().catch(console.error)
  }, [token])

  useEffect(() => {
    if (!token || !user?.id) return
    const socket = connectSocket(token, user.id)
    const onNotification = (payload: NotificationItem) => {
      setNotifications((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)])
      if (soundOn) {
        try {
          const audio = new Audio('/notification.mp3')
          audio.volume = 0.35
          void audio.play()
        } catch {
          // Browser may block autoplay.
        }
      }
      document.title = `(${notifications.filter((item) => !item.is_read).length + 1}) ZChat`
    }
    const onNotificationUpdated = (payload: NotificationItem) => {
      setNotifications((prev) => prev.map((item) => item.id === payload.id ? { ...item, ...payload } : item))
    }
    const onNotificationDeleted = (payload: { id?: number | string }) => {
      setNotifications((prev) => prev.filter((item) => String(item.id) !== String(payload?.id)))
    }
    const onAllRead = () => {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
    }
    socket.on('notification:new', onNotification)
    socket.on('notification:updated', onNotificationUpdated)
    socket.on('notification:deleted', onNotificationDeleted)
    socket.on('notification:all-read', onAllRead)
    return () => {
      socket.off('notification:new', onNotification)
      socket.off('notification:updated', onNotificationUpdated)
      socket.off('notification:deleted', onNotificationDeleted)
      socket.off('notification:all-read', onAllRead)
    }
  }, [notifications, soundOn, token, user?.id])

  const counts = useMemo(() => {
    const base: Record<Category, number> = { all: notifications.length, messages: 0, calls: 0, social: 0, system: 0 }
    notifications.forEach((item) => {
      base[getCategory(item.type)] += 1
    })
    return base
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications
      .filter((item) => activeCategory === 'all' || getCategory(item.type) === activeCategory)
      .filter((item) => isInDateFilter(item, readFilter))
      .filter((item) => !q || `${item.title} ${item.body || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const value = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sortMode === 'newest' ? value : -value
      })
  }, [activeCategory, notifications, query, readFilter, sortMode])

  const openNotification = async (item: NotificationItem) => {
    const meta = parseMeta(item)
    const conversationId = meta.conversationId ?? meta.conversation_id
    const postId = meta.postId ?? meta.post_id
    if (!item.is_read && token) {
      await api.readNotification(token, item.id).catch(() => undefined)
      setNotifications((prev) => prev.map((notif) => notif.id === item.id ? { ...notif, is_read: 1 } : notif))
    }
    if (conversationId) navigate(`/messages?conversation=${encodeURIComponent(String(conversationId))}`)
    else if (postId) navigate(`/posts/${postId}`)
  }

  const markReadState = async (item: NotificationItem, read: boolean) => {
    if (!token) return
    setBusyId(item.id)
    try {
      if (read) await api.readNotification(token, item.id)
      else await api.unreadNotification(token, item.id)
      setNotifications((prev) => prev.map((notif) => notif.id === item.id ? { ...notif, is_read: read ? 1 : 0 } : notif))
    } finally {
      setBusyId(null)
    }
  }

  const deleteNotification = async (item: NotificationItem) => {
    if (!token) return
    setBusyId(item.id)
    try {
      await api.deleteNotification(token, item.id)
      setNotifications((prev) => prev.filter((notif) => notif.id !== item.id))
    } finally {
      setBusyId(null)
    }
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Thông báo</h1>
          <p>Theo dõi tin nhắn, cuộc gọi, tương tác xã hội và cảnh báo hệ thống trong một nơi.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={async () => {
            if (!token) return
            await api.readAllNotifications(token)
            setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
          }}>
            <CheckCheck size={16} /> Đã đọc tất cả
          </button>
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen}>
            <Settings size={16} /> Cài đặt
          </button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.searchBox}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thông báo" />
        </label>
        <select value={readFilter} onChange={(event) => setReadFilter(event.target.value as ReadFilter)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="unread">Chưa đọc</option>
          <option value="read">Đã đọc</option>
          <option value="today">Hôm nay</option>
          <option value="yesterday">Hôm qua</option>
          <option value="week">Tuần này</option>
          <option value="month">Tháng này</option>
        </select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>
      </section>

      <nav className={styles.tabs} aria-label="Lọc thông báo">
        {(Object.keys(categoryMeta) as Category[]).map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? styles.tabActive : ''}
            onClick={() => setActiveCategory(category)}
            style={{ '--tab-color': categoryMeta[category].color } as CSSProperties}
          >
            {categoryMeta[category].label} <span>{counts[category]}</span>
          </button>
        ))}
      </nav>

      {settingsOpen ? (
        <section className={styles.settingsPanel}>
          {['Tin nhắn', 'Cuộc gọi', 'Lời mời kết bạn', 'Bình luận', 'Lượt thích', 'Desktop', 'Email'].map((label) => (
            <label key={label}>
              <span>{label}</span>
              <input type="checkbox" defaultChecked />
            </label>
          ))}
          <button type="button" onClick={() => setSoundOn((value) => !value)}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />} Âm thanh {soundOn ? 'bật' : 'tắt'}
          </button>
        </section>
      ) : null}

      <section className={styles.summary}>
        <strong>{unreadCount}</strong>
        <span>thông báo chưa đọc</span>
      </section>

      <section className={styles.list} aria-live="polite">
        {filteredNotifications.map((item) => {
          const category = getCategory(item.type)
          const Icon = iconForNotification(item)
          const meta = parseMeta(item)
          const avatarText = String(meta.userName || meta.requesterName || item.title || 'Z').slice(0, 1).toUpperCase()
          return (
            <article key={item.id} className={`${styles.card} ${!item.is_read ? styles.unread : ''}`}>
              <button type="button" className={styles.cardMain} onClick={() => void openNotification(item)}>
                <span className={styles.avatar}>{avatarText}</span>
                <span className={styles.iconBadge} style={{ background: categoryMeta[category].color }}>
                  <Icon size={16} />
                </span>
                <span className={styles.content}>
                  <strong>{item.title}</strong>
                  <span>{item.body || 'Thông báo mới từ ZChat'}</span>
                  <small>{timeAgo(item.created_at)}</small>
                </span>
                {!item.is_read ? <i className={styles.unreadDot} /> : null}
              </button>
              <div className={styles.actions}>
                <button type="button" disabled={busyId === item.id} onClick={() => void openNotification(item)}>
                  Mở
                </button>
                <button type="button" disabled={busyId === item.id} onClick={() => void markReadState(item, !item.is_read)}>
                  <Check size={14} /> {item.is_read ? 'Chưa đọc' : 'Đã đọc'}
                </button>
                <button type="button" disabled={busyId === item.id} onClick={() => void deleteNotification(item)}>
                  <Trash2 size={14} /> Xóa
                </button>
              </div>
            </article>
          )
        })}
        {filteredNotifications.length === 0 ? <p className={styles.empty}>Không có thông báo phù hợp.</p> : null}
      </section>
    </main>
  )
}
