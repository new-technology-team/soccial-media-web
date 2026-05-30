'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import type { FeedComment, FeedPost } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const postId = String(params.id || '').trim()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      setComments([])
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const [postRes, commentRes] = await Promise.all([
          api.getPost(postId, token || undefined),
          api.listComments(postId, token || undefined),
        ])
        setPost(postRes.post || null)
        setComments(commentRes.comments)
      } catch (error) {
        console.error('Không thể tải chi tiết bài viết', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [postId, token])

  useEffect(() => {
    if (!token || !me?.id || !postId) return
    const socket = connectSocket(token, me.id)

    const isThisPost = (value: unknown) => String(value || '') === String(postId)
    const onPostUpdated = (payload: { post?: FeedPost }) => {
      if (payload?.post && isThisPost(payload.post.id)) setPost(payload.post)
    }
    const onPostDeleted = (payload: { postId?: number | string }) => {
      if (isThisPost(payload?.postId)) setPost(null)
    }
    const onPostReaction = (payload: { postId?: number | string; actorId?: number | string; reaction?: string | null; reactionCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      setPost((current) =>
        current
          ? {
              ...current,
              reactionCount: Number(payload.reactionCount ?? current.reactionCount),
              viewerReaction: String(payload.actorId || '') === String(me.id) ? payload.reaction || null : current.viewerReaction,
            }
          : current
      )
    }
    const onCommentCreated = (payload: { postId?: number | string; comment?: FeedComment; commentCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      if (payload.comment) {
        setComments((prev) =>
          prev.some((item) => String(item.id) === String(payload.comment?.id)) ? prev : [...prev, payload.comment as FeedComment]
        )
      }
      setPost((current) => (current ? { ...current, commentCount: Number(payload.commentCount ?? current.commentCount + 1) } : current))
    }
    const onCommentDeleted = (payload: { postId?: number | string; commentId?: number | string; commentCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      setComments((prev) => prev.filter((item) => String(item.id) !== String(payload.commentId)))
      setPost((current) => (current ? { ...current, commentCount: Number(payload.commentCount ?? Math.max(0, current.commentCount - 1)) } : current))
    }
    const onAvatarUpdated = (payload: { userId?: number | string; avatarUrl?: string }) => {
      const avatarUrl = payload?.avatarUrl?.startsWith('/uploads/') ? `/backend${payload.avatarUrl}` : payload?.avatarUrl || null
      setPost((current) =>
        current && String(current.authorId) === String(payload?.userId) ? { ...current, authorAvatar: avatarUrl } : current
      )
      setComments((prev) =>
        prev.map((comment) => (String(comment.userId) === String(payload?.userId) ? { ...comment, authorAvatar: avatarUrl } : comment))
      )
    }

    socket.on('post:updated', onPostUpdated)
    socket.on('post:deleted', onPostDeleted)
    socket.on('post:reaction', onPostReaction)
    socket.on('comment:created', onCommentCreated)
    socket.on('comment:deleted', onCommentDeleted)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('post:updated', onPostUpdated)
      socket.off('post:deleted', onPostDeleted)
      socket.off('post:reaction', onPostReaction)
      socket.off('comment:created', onCommentCreated)
      socket.off('comment:deleted', onCommentDeleted)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [me?.id, postId, token])

  const createdAtText = useMemo(() => {
    if (!post) return ''
    return new Date(post.createdAt).toLocaleString('vi-VN')
  }, [post])

  const handleAddComment = async () => {
    if (!token || !commentInput.trim() || !postId) return
    try {
      const response = await api.addComment(token, postId, commentInput.trim())
      setComments((prev) =>
        prev.some((item) => String(item.id) === String(response.comment.id)) ? prev : [...prev, response.comment]
      )
      setPost((current) => (current ? { ...current, commentCount: current.commentCount + 1 } : current))
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Chi tiết bài viết</h1>
          <p>Xem nội dung đầy đủ và toàn bộ bình luận theo thời gian thực.</p>
        </div>

        {loading && (
          <div className={styles.infoCard}>
            <Skeleton style={{ height: 192, borderRadius: 12, marginBottom: 12 }} />
            <Skeleton style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
            <Skeleton style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
            <Skeleton style={{ height: 64, borderRadius: 12 }} />
          </div>
        )}

        {!loading && !post && <div className={styles.infoCard}>Không tìm thấy bài viết.</div>}

        {post ? (
          <article className={styles.postCard}>
            <header className={styles.postHeader}>
              <Link to={`/profile/${post.authorId}`}>
                <h2>{post.authorName}</h2>
              </Link>
              <p>{createdAtText}</p>
            </header>

            <p className={styles.postContent}>{post.content}</p>

            {post.mediaUrl ? (
              <img
                src={post.mediaUrl}
                alt="Ảnh bài viết"
                className={styles.postMedia}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}

            <div className={styles.postMeta}>
              {post.reactionCount} lượt thích • {post.commentCount} bình luận
            </div>
          </article>
        ) : null}

        <section className={styles.commentCard}>
          <h3>Bình luận</h3>

          {token ? (
            <div className={styles.commentForm}>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Viết bình luận của bạn..."
                className={styles.commentTextarea}
              />
              <button type="button" onClick={handleAddComment} disabled={!commentInput.trim()} className={styles.submitBtn}>
                Gửi bình luận
              </button>
            </div>
          ) : null}

          <div className={styles.commentList}>
            {comments.map((comment) => (
              <article key={comment.id} className={styles.commentItem}>
                <div className={styles.commentAvatarWrap}>
                  <Avatar>
                    <AvatarImage src={comment.authorAvatar || ''} />
                    <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                </div>
                <div className={styles.commentBody}>
                  <p className={styles.commentAuthor}>
                    <Link to={`/profile/${comment.userId}`}>{comment.authorName}</Link>
                  </p>
                  <p className={styles.commentText}>{comment.content}</p>
                  <p className={styles.commentTime}>{new Date(comment.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </article>
            ))}

            {comments.length === 0 ? <p className={styles.emptyText}>Chưa có bình luận nào.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
