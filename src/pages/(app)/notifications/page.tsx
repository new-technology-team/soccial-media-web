'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageSquare,
  Trash2,
  UserPlus,
  Flame,
  Share2,
  AlertCircle,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import styles from './page.module.css'

interface Notification {
  id: string | number
  type: 'like' | 'comment' | 'follow' | 'mention' | 'report' | 'share'
  title: string
  message: string
  avatarUrl?: string
  authorName?: string
  authorId?: string | number
  isRead: boolean
  createdAt: string
  actionUrl?: string
  data?: Record<string, any>
}

const NOTIFICATION_TYPES = {
  like: {
    icon: Heart,
    label: 'Lượt thích',
    bgColor: '#ff6b6b',
  },
  comment: {
    icon: MessageSquare,
    label: 'Bình luận',
    bgColor: '#4ecdc4',
  },
  follow: {
    icon: UserPlus,
    label: 'Theo dõi',
    bgColor: '#45b7d1',
  },
  mention: {
    icon: Bell,
    label: 'Nhắc đến',
    bgColor: '#ffa500',
  },
  share: {
    icon: Share2,
    label: 'Chia sẻ',
    bgColor: '#9b59b6',
  },
  report: {
    icon: AlertCircle,
    label: 'Báo cáo',
    bgColor: '#e74c3c',
  },
}

const getRelativeTime = (value?: string | Date | null) => {
  if (!value) return 'Vừa xong'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()

  if (Number.isNaN(diffMs)) return 'Vừa xong'

  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes}p`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  if (diffWeeks < 4) return `${diffWeeks}w`

  return date.toLocaleDateString('vi-VN')
}

export default function NotificationsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | Notification['type']>('all')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | number | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    let result = [...notifications]

    if (filter === 'unread') {
      result = result.filter((n) => !n.isRead)
    } else if (filter !== 'all') {
      result = result.filter((n) => n.type === filter)
    }

    return result
  }, [notifications, filter])

  const markAllAsRead = async () => {
    try {
      // TODO: Call API to mark all as read
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
        }))
      )
    } catch (error) {
      console.error('Không thể đánh dấu tất cả đã đọc', error)
    }
  }

  const deleteNotification = async (id: string | number) => {
    setDeleting(id)
    try {
      // TODO: Call API to delete notification
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (error) {
      console.error('Không thể xóa thông báo', error)
    } finally {
      setDeleting(null)
    }
  }

  const markAsRead = (id: string | number) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              isRead: true,
            }
          : n
      )
    )
  }

  useEffect(() => {
    // TODO: Load notifications from API
    setLoading(false)

    // Mock data for demo
    setNotifications([
      {
        id: 1,
        type: 'like',
        title: 'Nguyễn Văn A đã thích bài viết của bạn',
        message: 'Bài viết: "Hôm nay thời tiết đẹp lắm"',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nguyễn',
        authorName: 'Nguyễn Văn A',
        authorId: 1,
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
        actionUrl: '/posts/1',
      },
      {
        id: 2,
        type: 'comment',
        title: 'Trần Thị B bình luận trên bài viết của bạn',
        message: '"Quá tuyệt vời! Tôi rất thích bài viết này."',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tran',
        authorName: 'Trần Thị B',
        authorId: 2,
        isRead: false,
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        actionUrl: '/posts/2',
      },
      {
        id: 3,
        type: 'follow',
        title: 'Lê Văn C đã theo dõi bạn',
        message: 'Người dùng mới theo dõi hồ sơ của bạn',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Le',
        authorName: 'Lê Văn C',
        authorId: 3,
        isRead: true,
        createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
        actionUrl: '/profile/3',
      },
      {
        id: 4,
        type: 'mention',
        title: 'Phạm Thị D nhắc đến bạn',
        message: '"@bạn, bạn xem cái này nha" trong bài viết',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pham',
        authorName: 'Phạm Thị D',
        authorId: 4,
        isRead: true,
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        actionUrl: '/posts/4',
      },
      {
        id: 5,
        type: 'share',
        title: 'Hoàng Văn E đã chia sẻ bài viết của bạn',
        message: 'Bài viết của bạn đã được chia sẻ',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hoang',
        authorName: 'Hoàng Văn E',
        authorId: 5,
        isRead: true,
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        actionUrl: '/posts/1',
      },
    ])
  }, [token])

  useEffect(() => {
    if (!token || !me?.id) return

    // Connect to socket for real-time notifications
    const socket = connectSocket(token, me.id)

    const handleNewNotification = (payload: Notification) => {
      setNotifications((prev) => [payload, ...prev])
    }

    socket.on('notification:new', handleNewNotification)

    return () => {
      socket.off('notification:new', handleNewNotification)
    }
  }, [token, me?.id])

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.hero}>
          <Skeleton style={{ width: '200px', height: '40px' }} />
        </div>
        <div className={styles.list} style={{ marginTop: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: '80px', borderRadius: '13px' }} />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Trung tâm thông báo</p>
          <h1>Thông báo của bạn</h1>
          <p className={styles.heroSub}>
            Theo dõi tất cả hoạt động, tương tác và cập nhật quan trọng từ cộng đồng của bạn.
          </p>
        </div>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={markAllAsRead}>
            <CheckCheck size={16} />
            Đánh dấu tất cả ({unreadCount})
          </button>
        )}
      </div>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'unread' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('unread')}
        >
          Chưa đọc ({unreadCount})
        </button>
        {Object.entries(NOTIFICATION_TYPES).map(([type, config]) => (
          <button
            key={type}
            type="button"
            className={`${styles.filterBtn} ${filter === type ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(type as Notification['type'])}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.mainPanel}>
          <div className={styles.panelHead}>
            <h2>{filter === 'all' ? 'Tất cả thông báo' : 'Thông báo'}</h2>
            <span>{filteredNotifications.length} mục</span>
          </div>

          {filteredNotifications.length > 0 ? (
            <div className={styles.list}>
              {filteredNotifications.map((notif) => {
                const typeConfig = NOTIFICATION_TYPES[notif.type]
                const IconComponent = typeConfig.icon

                return (
                  <Link
                    key={notif.id}
                    to={notif.actionUrl || '#'}
                    onClick={() => markAsRead(notif.id)}
                    className={`${styles.item} ${!notif.isRead ? styles.itemUnread : ''}`}
                  >
                    <div className={styles.itemIconWrap} style={{ background: typeConfig.bgColor }}>
                      <IconComponent className={styles.itemTypeIcon} />
                    </div>

                    <div className={styles.itemBody}>
                      <p>{notif.title}</p>
                      <small>{notif.message}</small>
                    </div>

                    <span style={{ fontSize: '0.82rem', color: '#9aa5ae' }}>
                      {getRelativeTime(notif.createdAt)}
                    </span>

                    <button
                      type="button"
                      className={styles.deleteNotifBtn}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void deleteNotification(notif.id)
                      }}
                      disabled={deleting === notif.id}
                      title="Xóa thông báo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Bell size={48} style={{ color: '#ccc', marginBottom: '0.5rem' }} />
              <p style={{ color: '#999', margin: 0 }}>Không có thông báo</p>
              <small style={{ color: '#bbb' }}>
                {filter === 'all'
                  ? 'Tất cả thông báo của bạn sẽ xuất hiện ở đây'
                  : 'Không có thông báo trong danh mục này'}
              </small>
            </div>
          )}
        </div>

        <aside className={styles.sidePanel}>
          <div className={styles.panelHead}>
            <h2>Thống kê</h2>
          </div>

          <div className={styles.statCard}>
            <h3>Tất cả</h3>
            <div className={styles.statValue}>{notifications.length}</div>
            <span>Tổng số thông báo</span>
          </div>

          <div className={styles.statCard}>
            <h3>Chưa đọc</h3>
            <div className={styles.statValue}>{unreadCount}</div>
            <span>Chờ xem xét</span>
          </div>

          <div className={styles.statCard}>
            <h3>Danh mục</h3>
            <ul>
              <li>Lượt thích ({notifications.filter((n) => n.type === 'like').length})</li>
              <li>Bình luận ({notifications.filter((n) => n.type === 'comment').length})</li>
              <li>Theo dõi ({notifications.filter((n) => n.type === 'follow').length})</li>
              <li>Nhắc đến ({notifications.filter((n) => n.type === 'mention').length})</li>
            </ul>
          </div>

          <div className={styles.statCard}>
            <h3>Mẹo</h3>
            <small style={{ display: 'block', lineHeight: 1.5, color: '#666' }}>
              Nhấp vào bất kỳ thông báo nào để xem chi tiết. Sử dụng bộ lọc ở trên cùng để tìm kiếm nhanh.
            </small>
          </div>
        </aside>
      </div>
    </main>
  )
}