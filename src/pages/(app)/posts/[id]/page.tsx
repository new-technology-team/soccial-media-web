'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { api, normalizeFeedComment, resolveApiAssetUrl } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import { normalizeFeedComment } from '@/api/client'
import type { FeedComment, FeedPost, PostReactionViewer } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

type ReactionType = (typeof POST_REACTIONS)[number]['type']

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Không rõ thời gian'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian'
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const getRelativeTime = (value?: string | Date | null) => {
  if (!value) return 'Vừa xong'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()

  if (Number.isNaN(diffMs)) return 'Vừa xong'

  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  return formatDateTime(value)
}

const countAllComments = (items: FeedComment[]): number =>
  items.reduce((total, item) => total + 1 + countAllComments(item.replies || []), 0)

const appendCommentOnce = (items: FeedComment[], comment: FeedComment): FeedComment[] => {
  const commentId = String(comment.id)
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null

  if (!parentId) {
    return items.some((item) => String(item.id) === commentId) ? items : [comment, ...items]
  }

  return items.map((item) => {
    if (String(item.id) === parentId) {
      const alreadyExists = (item.replies || []).some((reply) => String(reply.id) === commentId)

      return {
        ...item,
        replies: alreadyExists ? item.replies || [] : [...(item.replies || []), comment],
      }
    }

    return {
      ...item,
      replies: item.replies ? appendCommentOnce(item.replies, comment) : [],
    }
  })
}

const replaceCommentById = (items: FeedComment[], nextComment: FeedComment): FeedComment[] =>
  items.map((item) => {
    if (String(item.id) === String(nextComment.id)) return { ...nextComment, replies: nextComment.replies || item.replies || [] }
    return { ...item, replies: item.replies ? replaceCommentById(item.replies, nextComment) : [] }
  })

export default function PostDetailPage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const postId = String(params.id || '').trim()

  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [replyingToCommentIds, setReplyingToCommentIds] = useState<Record<string, boolean>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [commentReactionViewers, setCommentReactionViewers] = useState<Record<string, PostReactionViewer[]>>({})
  const [reactionViewerComment, setReactionViewerComment] = useState<FeedComment | null>(null)
  const [reactionViewerLoading, setReactionViewerLoading] = useState(false)
  const reactionPickerRef = useRef<HTMLDivElement>(null)

  const reactionPickerRef = useRef<HTMLDivElement>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const commentSectionRef = useRef<HTMLElement>(null)

  const loadData = async (silent = false) => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      setComments([])
      return
    }

    if (silent) {
      setReloading(true)
    } else {
      setLoading(true)
    }

    try {
      const [postRes, commentRes] = await Promise.all([
        api.getPost(postId, token || undefined),
        api.listComments(postId, token || undefined),
      ])

      setPost(postRes.post || null)
      setComments(commentRes.comments || [])
    } catch (error) {
      console.error('Không thể tải chi tiết bài viết', error)
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [postId, token])

  useEffect(() => {
    if (!token || !me?.id || !postId) return

    const socket = connectSocket(token, me.id)
    const isThisPost = (value: unknown) => String(value || '') === String(postId)

    const onPostUpdated = (payload: { post?: FeedPost }) => {
      if (payload?.post && isThisPost(payload.post.id)) {
        setPost(payload.post)
      }
    }

    const onPostDeleted = (payload: { postId?: number | string }) => {
      if (isThisPost(payload?.postId)) {
        setPost(null)
      }
    }

    const onPostReaction = (payload: {
      postId?: number | string
      actorId?: number | string
      reaction?: string | null
      reactionCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      setPost((current) =>
        current
          ? {
              ...current,
              reactionCount: Number(payload.reactionCount ?? current.reactionCount),
              viewerReaction:
                String(payload.actorId || '') === String(me.id)
                  ? payload.reaction || null
                  : current.viewerReaction,
            }
          : current,
      )
    }

    const onCommentCreated = (payload: {
      postId?: number | string
      comment?: FeedComment
      commentCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      if (payload.comment) {
        setComments((prev) => appendCommentOnce(prev, payload.comment as FeedComment))
      }

      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: Number(payload.commentCount ?? current.commentCount + 1),
            }
          : current,
      )
    }

    const onCommentDeleted = (payload: {
      postId?: number | string
      commentId?: number | string
      commentCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      setComments((prev) => removeCommentById(prev, payload.commentId))

      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: Number(payload.commentCount ?? Math.max(0, current.commentCount - 1)),
            }
          : current,
      )
    }
    const onCommentReaction = (payload: { postId?: number | string; commentId?: number | string; actorId?: number | string; reaction?: string | null; reactionCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      if (payload?.commentId) {
        setCommentReactionViewers((prev) => {
          const next = { ...prev }
          delete next[String(payload.commentId)]
          return next
        })
      }
      setComments((prev) => {
        const update = (items: FeedComment[]): FeedComment[] =>
          items.map((comment) => {
            if (String(comment.id) === String(payload.commentId)) {
              return {
                ...comment,
                reactionCount: Number(payload.reactionCount ?? comment.reactionCount),
                viewerReaction: String(payload.actorId || '') === String(me.id) ? payload.reaction || null : comment.viewerReaction,
              }
            }
            return { ...comment, replies: comment.replies ? update(comment.replies) : [] }
          })
        return update(prev)
      })
    }
    const onAvatarUpdated = (payload: { userId?: number | string; avatarUrl?: string }) => {
      const avatarUrl = resolveApiAssetUrl(payload?.avatarUrl) ?? payload?.avatarUrl ?? null

      setPost((current) =>
        current && String(current.authorId) === String(payload?.userId)
          ? { ...current, authorAvatar: avatarUrl }
          : current,
      )

      setComments((prev) =>
        prev.map((comment) =>
          String(comment.userId) === String(payload?.userId)
            ? { ...comment, authorAvatar: avatarUrl }
            : comment,
        ),
      )
    }

    socket.on('post:updated', onPostUpdated)
    socket.on('post:deleted', onPostDeleted)
    socket.on('post:reaction', onPostReaction)
    socket.on('comment:created', onCommentCreated)
    socket.on('comment:deleted', onCommentDeleted)
    socket.on('comment:reaction', onCommentReaction)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('post:updated', onPostUpdated)
      socket.off('post:deleted', onPostDeleted)
      socket.off('post:reaction', onPostReaction)
      socket.off('comment:created', onCommentCreated)
      socket.off('comment:deleted', onCommentDeleted)
      socket.off('comment:reaction', onCommentReaction)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [me?.id, postId, token])

  useEffect(() => {
    if (!showReactionPicker) return

    const handleClickOutside = (event: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) {
        setShowReactionPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showReactionPicker])

  const createdAtText = useMemo(() => formatDateTime(post?.createdAt), [post?.createdAt])
  const relativeCreatedAtText = useMemo(() => getRelativeTime(post?.createdAt), [post?.createdAt])

  const totalComments = useMemo(() => countAllComments(comments), [comments])

  const currentReaction = useMemo(() => {
    if (!post?.viewerReaction) return null
    return POST_REACTIONS.find((reaction) => reaction.type === post.viewerReaction) || null
  }, [post?.viewerReaction])

  const handleReactPost = async (type: ReactionType) => {
    if (!token || !post) return

    const oldPost = post
    const isSameReaction = post.viewerReaction === type

    setShowReactionPicker(false)

    setPost({
      ...post,
      viewerReaction: isSameReaction ? null : type,
      reactionCount: Math.max(0, post.reactionCount + (isSameReaction ? -1 : post.viewerReaction ? 0 : 1)),
    })

    try {
      const response = isSameReaction
        ? await api.unreactPost(token, post.id)
        : await api.reactPost(token, post.id, type)

      setPost(response.post)
    } catch (error) {
      setPost(oldPost)
      console.error('Không thể thả cảm xúc', error)
    }
  }

  const handleFocusComment = () => {
    commentSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    window.setTimeout(() => {
      commentTextareaRef.current?.focus()
    }, 350)
  }

  const handleAddComment = async () => {
    const value = commentInput.trim()

    if (!token || !value || !postId || submittingComment) return

    setSubmittingComment(true)

    try {
      const response = await api.addComment(token, postId, value)

      setComments((prev) => appendCommentOnce(prev, normalizeFeedComment(response.comment)))
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      )
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleAddReply = async (comment: FeedComment) => {
    const key = String(comment.id)
    const value = (replyInputs[key] || '').trim()

    if (!token || !value || busyCommentId || !postId) return

    setBusyCommentId(key)

    try {
      const response = await api.addComment(token, postId, value, null, comment.id)

      setComments((prev) => appendCommentOnce(prev, normalizeFeedComment(response.comment)))
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      )
      setReplyInputs((prev) => ({ ...prev, [key]: '' }))
      setReplyingToCommentIds((prev) => ({ ...prev, [key]: false }))
    } catch (error) {
      console.error('Không thể gửi phản hồi', error)
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleReactComment = async (comment: FeedComment) => {
    if (!token) return
    const key = String(comment.id)
    setBusyCommentId(key)
    try {
      const response = comment.viewerReaction
        ? await api.unreactComment(token, comment.id)
        : await api.reactComment(token, comment.id, 'like')
      setComments((prev) => replaceCommentById(prev, response.comment))
    } catch (error) {
      console.error('Không thể cập nhật lượt thích bình luận', error)
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleOpenCommentReactionViewers = async (comment: FeedComment) => {
    const key = String(comment.id)
    setReactionViewerComment(comment)
    if (commentReactionViewers[key]) return
    setReactionViewerLoading(true)
    try {
      const response = await api.listCommentReactions(comment.id)
      setCommentReactionViewers((prev) => ({ ...prev, [key]: response.reactions }))
    } catch (error) {
      console.error('Không thể tải danh sách người thích bình luận', error)
      setCommentReactionViewers((prev) => ({ ...prev, [key]: [] }))
    } finally {
      setReactionViewerLoading(false)
    }
  }

  const renderComment = (comment: FeedComment, depth = 0): React.ReactNode => {
    const key = String(comment.id)
    const showReplyForm = replyingToCommentIds[key]
    const canReply = Boolean(token && depth < 3)

    return (
      <div
        key={comment.id}
        className={`${styles.commentItem} ${depth > 0 ? styles.commentReply : ''}`}
      >
        <Link to={`/profile/${comment.userId}`} className={styles.commentAvatarLink}>
          <Avatar className={styles.commentAvatar}>
            <AvatarImage src={comment.authorAvatar || ''} />
            <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
        <div className={styles.commentBody}>
          <p className={styles.commentAuthor}>
            <Link to={`/profile/${comment.userId}`}>{comment.authorName}</Link>
          </p>
          {comment.content ? <p className={styles.commentText}>{comment.content}</p> : null}
          {comment.imageUrl ? <img src={comment.imageUrl} alt="Ảnh trong bình luận" className={styles.commentImage} loading="lazy" /> : null}
          <div className={styles.commentActions}>
            <p className={styles.commentTime}>{new Date(comment.createdAt).toLocaleString('vi-VN')}</p>
            <button
              type="button"
              className={`${styles.replyBtn} ${comment.viewerReaction ? styles.commentLiked : ''}`}
              onClick={() => void handleReactComment(comment)}
              disabled={busyCommentId === key}
            >
              {comment.viewerReaction ? 'Đã thích' : 'Thích'}{comment.reactionCount ? ` · ${comment.reactionCount}` : ''}
            </button>
            {comment.reactionCount ? (
              <button
                type="button"
                className={styles.replyBtn}
                onClick={() => void handleOpenCommentReactionViewers(comment)}
              >
                Xem lượt thích
              </button>
            ) : null}
            {token ? (
              <button
                type="button"
                className={styles.replyActionBtn}
                onClick={() =>
                  setReplyingToCommentIds((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
                }
              >
                <Reply size={14} />
                {showReplyForm ? 'Hủy' : 'Trả lời'}
              </button>
            ) : null}
          </div>

          {showReplyForm ? (
            <div className={styles.replyForm}>
              <input
                className={styles.replyInput}
                value={replyInputs[key] || ''}
                onChange={(event) =>
                  setReplyInputs((prev) => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                placeholder={`Trả lời ${comment.authorName || 'người dùng'}...`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleAddReply(comment)
                  }
                }}
                autoFocus
              />

              <button
                type="button"
                className={styles.replySubmit}
                onClick={() => void handleAddReply(comment)}
                disabled={busyCommentId === key || !replyInputs[key]?.trim()}
              >
                {busyCommentId === key ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className={styles.replyList}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <h1>Chi tiết bài viết</h1>
          <p>Xem nội dung đầy đủ và toàn bộ bình luận theo thời gian thực.</p>
        </div>

        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <Skeleton className={styles.skeletonBack} />
            <div>
              <Skeleton className={styles.skeletonTitle} />
              <Skeleton className={styles.skeletonSubtitle} />
            </div>
          </div>

          <div className={styles.layout}>
            <section className={styles.mainColumn}>
              <div className={styles.postCard}>
                <Skeleton className={styles.skeletonHeader} />
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonTextShort} />
                <Skeleton className={styles.skeletonMedia} />
              </div>

              <div className={styles.commentCard}>
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonTextShort} />
              </div>
            </section>

            <aside className={styles.sideColumn}>
              <Skeleton className={styles.skeletonSide} />
            </aside>
          </div>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <Sparkles size={46} />
            <h1>Không tìm thấy bài viết</h1>
            <p>Bài viết có thể đã bị xóa, bị ẩn hoặc đường dẫn không còn hợp lệ.</p>

            <div className={styles.emptyActions}>
              <button type="button" className={styles.primaryBtn} onClick={() => navigate('/')}>
                <ArrowLeft size={18} />
                Về trang chủ
              </button>

              <button type="button" className={styles.secondaryBtn} onClick={() => void loadData()}>
                <RefreshCw size={18} />
                Tải lại
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundBlurOne} />
      <div className={styles.backgroundBlurTwo} />

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <button type="button" className={styles.backLink} onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>

            <div className={styles.headerContent}>
              <span className={styles.pageBadge}>
                <Sparkles size={14} />
                Bài viết realtime
              </span>
              <h1>Chi tiết bài viết</h1>
              <p>Theo dõi nội dung, cảm xúc và bình luận mới nhất</p>
            </div>
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void loadData(true)}
            disabled={reloading}
            title="Làm mới"
          >
            <RefreshCw size={18} className={reloading ? styles.spinIcon : ''} />
          </button>
        </div>

        <div className={styles.layout}>
          <section className={styles.mainColumn}>
            <article className={styles.postCard}>
              <header className={styles.postHeader}>
                <div className={styles.authorBlock}>
                  <Link to={`/profile/${post.authorId}`}>
                    <Avatar className={styles.postAvatar}>
                      <AvatarImage src={post.authorAvatar || ''} />
                      <AvatarFallback>{post.authorName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  </Link>

                  <div>
                    <Link to={`/profile/${post.authorId}`} className={styles.authorName}>
                      {post.authorName || 'Người dùng'}
                    </Link>
                    <div className={styles.postTimeRow}>
                      <span>{relativeCreatedAtText}</span>
                      <span>•</span>
                      <span>{createdAtText}</span>
                    </div>
                  </div>
                </div>

                <button type="button" className={styles.iconBtn}>
                  <MoreHorizontal size={20} />
                </button>
              </header>

              {post.content ? (
                <div className={styles.postContentBox}>
                  <p className={styles.postContent}>{post.content}</p>
                </div>
              ) : (
                <div className={styles.noContentBox}>
                  <Sparkles size={18} />
                  Bài viết này không có nội dung chữ.
                </div>
              )}

              {post.mediaUrl ? (
                <div className={styles.mediaFrame}>
                  {isVideoMediaUrl(post.mediaUrl) ? (
                    <video
                      src={post.mediaUrl}
                      className={styles.postMedia}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt="Ảnh bài viết"
                      className={styles.postMedia}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>
              ) : null}

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <span className={styles.reactionBadge}>{currentReaction?.emoji || '👍'}</span>
                  <span>{post.reactionCount} lượt cảm xúc</span>
                </div>

                <button type="button" onClick={handleFocusComment}>
                  {totalComments || post.commentCount} bình luận
                </button>
              </div>

              <div className={styles.actionBar}>
                {token ? (
                  <div className={styles.reactionWrap} ref={reactionPickerRef}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${
                        currentReaction ? styles.actionBtnActive : ''
                      }`}
                      onClick={() => setShowReactionPicker((value) => !value)}
                      title={currentReaction ? currentReaction.label : 'Thả cảm xúc'}
                    >
                      {currentReaction ? (
                        <>
                          <span className={styles.actionEmoji}>{currentReaction.emoji}</span>
                          <span className={styles.actionLabel}>{currentReaction.label}</span>
                        </>
                      ) : (
                        <>
                          <Heart size={18} />
                          <span className={styles.actionLabel}>Thích</span>
                        </>
                      )}
                    </button>

                    {showReactionPicker ? (
                      <div className={styles.reactionPicker}>
                        {POST_REACTIONS.map((reaction) => (
                          <button
                            key={reaction.type}
                            type="button"
                            className={`${styles.reactionOption} ${
                              post.viewerReaction === reaction.type
                                ? styles.reactionOptionActive
                                : ''
                            }`}
                            onClick={() => void handleReactPost(reaction.type)}
                            title={reaction.label}
                          >
                            <span>{reaction.emoji}</span>
                            <small>{reaction.label}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button type="button" className={styles.actionBtn} disabled>
                    <Heart size={18} />
                    <span className={styles.actionLabel}>Thích</span>
                  </button>
                )}

                <button type="button" className={styles.actionBtn} onClick={handleFocusComment}>
                  <MessageCircle size={18} />
                  <span className={styles.actionLabel}>Bình luận</span>
                </button>

                <button type="button" className={styles.actionBtn} onClick={() => void handleSharePost()}>
                  {copied ? <Copy size={18} /> : <Share2 size={18} />}
                  <span className={styles.actionLabel}>{copied ? 'Đã copy' : 'Chia sẻ'}</span>
                </button>
              </div>
            </article>

            <section className={styles.commentCard} ref={commentSectionRef}>
              <div className={styles.commentHeader}>
                <div>
                  <h2>Bình luận</h2>
                  <p>{totalComments} bình luận đang hiển thị</p>
                </div>

                <button type="button" onClick={() => void loadData(true)} disabled={reloading} className={styles.refreshCommentBtn}>
                  <RefreshCw size={16} className={reloading ? styles.spinIcon : ''} />
                </button>
              </div>

              {token ? (
                <div className={styles.commentForm}>
                  <div className={styles.commentFormTop}>
                    <Avatar className={styles.myAvatar}>
                      <AvatarImage src={me?.avatarUrl || ''} />
                      <AvatarFallback>{me?.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>

                    <div className={styles.commentInputWrap}>
                      <textarea
                        ref={commentTextareaRef}
                        value={commentInput}
                        onChange={(event) => setCommentInput(event.target.value)}
                        placeholder="Viết bình luận của bạn..."
                        className={styles.commentTextarea}
                        rows={2}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void handleAddComment()
                          }
                        }}
                      />

                      <div className={styles.commentFormActions}>
                        <button
                          type="button"
                          onClick={() => void handleAddComment()}
                          disabled={!commentInput.trim() || submittingComment}
                          className={styles.submitBtn}
                        >
                          {submittingComment ? (
                            <RefreshCw size={16} className={styles.spinIcon} />
                          ) : (
                            <>
                              <Send size={16} />
                              <span>Gửi</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.loginNotice}>
                  <div>
                    <ShieldCheck size={22} />
                    <p>Đăng nhập để thả cảm xúc và bình luận bài viết</p>
                  </div>
                  <Link to="/auth/login">Đăng nhập ngay</Link>
                </div>
              )}

              <div className={styles.commentList}>
                {comments.length > 0 ? (
                  comments.map((comment) => renderComment(comment))
                ) : (
                  <div className={styles.emptyComments}>
                    <MessageCircle size={42} />
                    <h3>Chưa có bình luận nào</h3>
                    <p>Hãy là người đầu tiên mở đầu cuộc trò chuyện</p>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className={styles.sideColumn}>
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <div className={styles.sideCardTitleRow}>
                  <UserRound size={18} />
                  <h3>Tác giả bài viết</h3>
                </div>
              </div>

              <div className={styles.authorMiniCard}>
                <Link to={`/profile/${post.authorId}`} className={styles.authorMiniLink}>
                  <Avatar className={styles.sideAvatar}>
                    <AvatarImage src={post.authorAvatar || ''} />
                    <AvatarFallback>{post.authorName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>

                  <div>
                    <div className={styles.authorMiniName}>{post.authorName || 'Người dùng'}</div>
                    <span className={styles.authorMiniRole}>Người đăng bài</span>
                  </div>
                </Link>
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <div className={styles.sideCardTitleRow}>
                  <Sparkles size={18} />
                  <h3>Thống kê bài viết</h3>
                </div>
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Cảm xúc</span>
                  <strong className={styles.statValue}>{post.reactionCount}</strong>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Bình luận</span>
                  <strong className={styles.statValue}>{totalComments || post.commentCount}</strong>
                </div>

                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Trạng thái</span>
                  <strong className={styles.statValue}>
                    <span className={styles.liveIndicator}>●</span>
                    Realtime
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <div className={styles.sideCardTitleRow}>
                  <ShieldCheck size={18} />
                  <h3>Mẹo tương tác</h3>
                </div>
              </div>

              <p className={styles.sideText}>
                💡 Thả cảm xúc, bình luận hoặc chia sẻ bài viết để tăng tương tác và giúp hệ thống đề xuất nội dung phù hợp hơn.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {reactionViewerComment ? (
        <div className={styles.viewerBackdrop} role="presentation" onClick={() => setReactionViewerComment(null)}>
          <section className={styles.viewerDialog} role="dialog" aria-label="Người thích bình luận" onClick={(event) => event.stopPropagation()}>
            <header className={styles.viewerHeader}>
              <div>
                <h3>Người thích bình luận</h3>
                <p>{reactionViewerComment.reactionCount} lượt thích</p>
              </div>
              <button type="button" onClick={() => setReactionViewerComment(null)} aria-label="Đóng">
                <X size={17} />
              </button>
            </header>
            <div className={styles.viewerList}>
              {reactionViewerLoading ? <p className={styles.emptyText}>Đang tải...</p> : null}
              {!reactionViewerLoading && (commentReactionViewers[String(reactionViewerComment.id)] || []).map((viewer) => (
                <Link key={`${viewer.userId}-${viewer.createdAt || viewer.reaction}`} to={`/profile/${viewer.userId}`} className={styles.viewerItem} onClick={() => setReactionViewerComment(null)}>
                  <Avatar className={styles.viewerAvatar}>
                    <AvatarImage src={viewer.avatarUrl || ''} />
                    <AvatarFallback>{viewer.fullName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong>{viewer.fullName}</strong>
                    <small>{viewer.reaction === 'like' ? 'Đã thích' : viewer.reaction}</small>
                  </span>
                </Link>
              ))}
              {!reactionViewerLoading && (commentReactionViewers[String(reactionViewerComment.id)] || []).length === 0 ? (
                <p className={styles.emptyText}>Chưa có lượt thích.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}