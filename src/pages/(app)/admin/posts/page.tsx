'use client'

import { useEffect, useMemo, useState } from 'react'
import { EyeOff, FileText, Globe, Heart, Lock, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { ConfirmDialog } from '@/components/dialogs'
import { api } from '@/api/client'
import type { FeedPost } from '@/types'
import styles from './page.module.css'

type PostStatus = 'published' | 'hidden' | 'deleted'
type PostVisibility = 'public' | 'private'
type ConfirmModalState = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

export default function AdminPostManagementPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [bulkWorking, setBulkWorking] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | PostVisibility>('all')

  const loadPosts = async () => {
    if (!token) return

    setLoading(true)
    setError('')
    setNotice('')

    try {
      const res = await api.adminPosts(token, {
        q: query.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
        limit: 200,
      })
      setPosts(res.posts)
      const visibleIds = new Set(res.posts.map((item) => item.id))
      setSelectedPostIds((prev) => prev.filter((id) => visibleIds.has(id)))
      setNotice(`Đã tải ${res.posts.length} bài viết để kiểm tra.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách bài viết'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, visibilityFilter])

  const analytics = useMemo(() => {
    const totalPosts = posts.length
    const hiddenPosts = posts.filter((p) => p.status === 'hidden').length
    const deletedPosts = posts.filter((p) => p.status === 'deleted').length
    const publishedPosts = posts.filter((p) => p.status === 'published').length
    const publicPosts = posts.filter((p) => p.visibility === 'public').length
    const privatePosts = posts.filter((p) => p.visibility === 'private').length

    const totalComments = posts.reduce((acc, post) => acc + Number(post.commentCount || 0), 0)
    const totalReactions = posts.reduce((acc, post) => acc + Number(post.reactionCount || 0), 0)

    return {
      totalPosts,
      hiddenPosts,
      deletedPosts,
      publishedPosts,
      publicPosts,
      privatePosts,
      totalComments,
      totalReactions,
    }
  }, [posts])

  const quickUpdateStatus = async (postId: number, status: PostStatus) => {
    if (!token) return
    try {
      setError('')
      setNotice('')
      await api.updateAdminPost(token, postId, { status })
      setNotice(status === 'hidden' ? `Đã ẩn bài viết #${postId}` : `Đã khôi phục bài viết #${postId}`)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái bài viết')
    }
  }

  const deletePost = async (postId: number) => {
    if (!token) return
    setConfirmModal({
      title: 'Xóa bài viết?',
      description: 'Hành động này sẽ chuyển trạng thái bài viết sang deleted.',
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          setError('')
          setNotice('')
          await api.deleteAdminPost(token, postId)
          setNotice(`Đã chuyển bài viết #${postId} sang trạng thái deleted.`)
          await loadPosts()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Không thể xóa bài viết')
          throw err
        }
      },
    })
  }

  const toggleSelectPost = (postId: number) => {
    setSelectedPostIds((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]))
  }

  const toggleSelectAllVisible = () => {
    const allVisibleIds = posts.map((post) => post.id)
    const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedPostIds.includes(id))
    if (isAllSelected) {
      setSelectedPostIds([])
      return
    }
    setSelectedPostIds(allVisibleIds)
  }

  const runBulkAction = async (action: 'hide' | 'delete') => {
    if (!token || selectedPostIds.length === 0 || bulkWorking) return

    const actionLabel = action === 'hide' ? 'ẩn' : 'xóa'
    setConfirmModal({
      title: `Xác nhận ${actionLabel} bài viết?`,
      description: `Bạn đang chọn ${selectedPostIds.length} bài viết. Hành động này sẽ áp dụng cho tất cả bài viết đã chọn.`,
      confirmLabel: action === 'hide' ? 'Ẩn' : 'Xóa',
      onConfirm: async () => {
        setBulkWorking(true)
        setError('')
        setNotice('')

        try {
          const results = await Promise.allSettled(
            selectedPostIds.map((postId) => {
              if (action === 'hide') {
                return api.updateAdminPost(token, postId, { status: 'hidden' })
              }
              return api.deleteAdminPost(token, postId)
            })
          )

          const failed = results.filter((item) => item.status === 'rejected').length
          const success = results.length - failed

          if (failed > 0) {
            setError(`Bulk ${actionLabel}: thành công ${success}, thất bại ${failed}. Vui lòng thử lại các mục lỗi.`)
          } else {
            setNotice(`Đã ${actionLabel} thành công ${success} bài viết đã chọn.`)
          }

          setSelectedPostIds([])
          await loadPosts()
        } finally {
          setBulkWorking(false)
        }
      },
    })
  }

  if (user?.role !== 'admin') {
    return <div className={styles.denied}>Bạn không có quyền truy cập khu vực admin.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Admin / Quản lý nội dung</p>
        <h1>Quản lý bài viết</h1>
        <p>Quản trị bài viết theo hướng duyệt nội dung: xem chi tiết, ẩn hoặc xóa bài vi phạm, không chỉnh sửa nội dung gốc.</p>
      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng bài viết</span>
            <FileText size={18} />
          </div>
          <strong>{analytics.totalPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Bài đang ẩn</span>
            <EyeOff size={18} />
          </div>
          <strong>{analytics.hiddenPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Bài đã xóa</span>
            <Trash2 size={18} />
          </div>
          <strong>{analytics.deletedPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng bình luận</span>
            <FileText size={18} />
          </div>
          <strong>{analytics.totalComments.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng cảm xúc</span>
            <Heart size={18} />
          </div>
          <strong>{analytics.totalReactions.toLocaleString('vi-VN')}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo nội dung hoặc tên tác giả"
            />
          </label>

          <select
            title="Lọc theo trạng thái"
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | PostStatus)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
            <option value="deleted">deleted</option>
          </select>

          <select
            title="Lọc theo quyền xem"
            aria-label="Lọc theo quyền xem"
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as 'all' | PostVisibility)}
          >
            <option value="all">Tất cả quyền xem</option>
            <option value="public">public</option>
            <option value="private">private</option>
          </select>

          <button type="button" className={styles.refreshBtn} onClick={loadPosts}>
            <RefreshCcw size={15} /> Làm mới
          </button>
          <button type="button" className={styles.refreshBtn} onClick={loadPosts}>
            <Search size={15} /> Lọc
          </button>
        </div>

        <div className={styles.visibilityStats}>
          <span>
            <Globe size={14} /> Công khai: <b>{analytics.publicPosts}</b>
          </span>
          <span>
            <Lock size={14} /> Riêng tư: <b>{analytics.privatePosts}</b>
          </span>
          <span>
            Đang hiển thị: <b>{analytics.publishedPosts}</b>
          </span>
        </div>

        <div className={styles.bulkBar}>
          <span>
            Đang chọn <b>{selectedPostIds.length}</b> / {posts.length} bài
          </span>
          <div className={styles.bulkActions}>
            <button type="button" className={styles.bulkBtn} onClick={toggleSelectAllVisible}>
              {posts.length > 0 && posts.every((item) => selectedPostIds.includes(item.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            <button
              type="button"
              className={styles.bulkBtn}
              disabled={selectedPostIds.length === 0 || bulkWorking}
              onClick={() => runBulkAction('hide')}
            >
              Ẩn đã chọn
            </button>
            <button
              type="button"
              className={`${styles.bulkBtn} ${styles.bulkDanger}`}
              disabled={selectedPostIds.length === 0 || bulkWorking}
              onClick={() => runBulkAction('delete')}
            >
              Xóa đã chọn
            </button>
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.notice}>{notice}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả bài viết"
                    checked={posts.length > 0 && posts.every((item) => selectedPostIds.includes(item.id))}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th>ID</th>
                <th>Tác giả</th>
                <th>Nội dung</th>
                <th>Chi tiết</th>
                <th>Hiển thị</th>
                <th>Trạng thái</th>
                <th>Tương tác</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const hasMedia = Boolean(post.mediaUrl)
                const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString('vi-VN') : '-'
                return (
                  <tr key={post.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn bài viết ${post.id}`}
                        checked={selectedPostIds.includes(post.id)}
                        onChange={() => toggleSelectPost(post.id)}
                      />
                    </td>
                    <td>#{post.id}</td>
                    <td>{post.authorName}</td>
                    <td>
                      <p className={styles.content}>{post.content || '(bài viết chỉ có media)'}</p>
                    </td>
                    <td>
                      <div className={styles.postMeta}>
                        <div><b>Post ID:</b> #{post.id}</div>
                        <div><b>Media:</b> {hasMedia ? 'Có' : 'Không'}</div>
                        <div><b>Tạo lúc:</b> {createdAt}</div>
                        <div><b>Tác giả:</b> {post.authorName}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status${post.status}`]}`}>{post.status}</span>
                    </td>
                    <td>
                      {post.reactionCount} react / {post.commentCount} comment
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" onClick={() => quickUpdateStatus(post.id, 'hidden')}>
                          <EyeOff size={14} /> Ẩn
                        </button>
                        <button type="button" className={styles.danger} onClick={() => deletePost(post.id)}>
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!loading && posts.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>Không có bài viết phù hợp bộ lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {loading ? <p className={styles.empty}>Đang tải dữ liệu...</p> : null}
      </section>
      <ConfirmDialog
        open={Boolean(confirmModal)}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null)
        }}
        title={confirmModal?.title || ''}
        description={confirmModal?.description || ''}
        confirmLabel={confirmModal?.confirmLabel || 'Xác nhận'}
        onConfirm={async () => {
          await confirmModal?.onConfirm()
        }}
      />
    </div>
  )
}
