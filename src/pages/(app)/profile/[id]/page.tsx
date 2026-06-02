"use client"

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Rss, Settings } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import { ReportDialog } from '@/components/dialogs'
import { useSocialRealtime } from '@/hooks/use-social-realtime'
import { toast } from '@/hooks/use-toast'
import ProfileTabs, { type ProfileTab } from '@/components/navigation/profile-tabs'
import type { FeedPost, FriendConnection } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

type ProfileUser = {
  userId: number
  displayName: string
  avatarUrl: string | null
  role: string
  isVerified: boolean
  lastActiveAt?: string | null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const profileId = params?.id || ''
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [socialActionBusy, setSocialActionBusy] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [reportAccountOpen, setReportAccountOpen] = useState(false)

  const isOwnProfile = Boolean(me?.id && String(me.id) === profileId)

  useEffect(() => {
    if (!profileId || !token) return
    setIsLoadingProfile(true)
    api.getUserProfile(token, Number(profileId))
      .then((r) => setProfileUser(r.user as ProfileUser | null))
      .catch(console.error)
      .finally(() => setIsLoadingProfile(false))
  }, [profileId, token])

  useEffect(() => {
    if (!profileId || !token) return
    setIsLoadingPosts(true)
    api.getUserPosts(token, Number(profileId))
      .then((r) => setPosts(r.posts))
      .catch(console.error)
      .finally(() => setIsLoadingPosts(false))
  }, [profileId, token])

  useEffect(() => {
    if (!token) return
    api
      .listFriends(token)
      .then((response) => {
        setFriends(response.friends)
        if (!profileId || isOwnProfile) {
          setFriendStatus('none')
          return
        }
        const matched = response.friends.find((friend) => String(friend.id) === profileId)
        setFriendStatus(matched?.status || 'none')
      })
      .catch(console.error)
  }, [isOwnProfile, profileId, token])

  const acceptedFriends = useMemo(
    () => friends.filter((friend) => friend.status === 'accepted'),
    [friends]
  )

  const profileFriend = useMemo(
    () => friends.find((friend) => String(friend.id) === profileId) || null,
    [friends, profileId]
  )

  const profileMedia = useMemo(
    () => posts.filter((post) => Boolean(post.mediaUrl || post.sharedPost?.mediaUrl)).slice(0, 6),
    [posts]
  )

  const getPostMediaUrl = (post: FeedPost) => post.mediaUrl || post.sharedPost?.mediaUrl || null
  const isVideoPost = (post: FeedPost) => {
    const mediaUrl = getPostMediaUrl(post)
    return Boolean(mediaUrl && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(mediaUrl))
  }

  const visiblePosts = useMemo(() => {
    if (activeTab === 'photos') return posts.filter((post) => getPostMediaUrl(post) && !isVideoPost(post))
    if (activeTab === 'videos') return posts.filter(isVideoPost)
    if (mediaOnly) return posts.filter((post) => Boolean(getPostMediaUrl(post)))
    return posts
  }, [activeTab, mediaOnly, posts])

  const totalInteractions = useMemo(
    () => posts.reduce((sum, post) => sum + post.reactionCount + post.commentCount, 0),
    [posts]
  )

  const profileName = isOwnProfile && me
    ? me.fullName
    : profileUser?.displayName || profileFriend?.fullName || `Người dùng #${profileId}`

  const profileAvatar = isOwnProfile && me
    ? me.avatarUrl
    : profileUser?.avatarUrl || profileFriend?.avatarUrl || null

  const initials = (profileName[0] || 'U').toUpperCase()

  const isOnline = useMemo(() => {
    if (isOwnProfile) return true
    const lastActive = profileUser?.lastActiveAt
    if (!lastActive) return false
    return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000
  }, [isOwnProfile, profileUser?.lastActiveAt])

  useSocialRealtime({
    token,
    user: me,
    setPosts,
  })

  useEffect(() => {
    setProfileAvatarBroken(false)
  }, [profileAvatar])

  const roleSource = isOwnProfile ? me?.role : (profileUser?.role || profileFriend?.role)
  const roleText = roleSource === 'admin'
    ? 'Quản trị viên hệ thống'
    : roleSource === 'moderator'
      ? 'Kiểm duyệt viên cộng đồng'
      : 'Thành viên ZChat'

  const accountText = isOwnProfile && me
    ? me.accountStatus === 'active' ? 'Tài khoản hoạt động'
      : me.accountStatus === 'restricted' ? 'Tài khoản bị hạn chế'
        : me.accountStatus === 'hidden' ? 'Tài khoản đang ẩn'
          : 'Tài khoản đã xóa'
    : friendStatus === 'accepted' ? 'Đã kết bạn'
      : friendStatus === 'pending' ? 'Đang chờ xác nhận'
        : 'Chưa kết nối'

  const handleRequestFriend = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    setSocialActionBusy(true)
    try {
      await api.requestFriend(token, Number(profileId))
      setFriendStatus('pending')
    } catch (error) {
      console.error('Không thể gửi lời mời kết bạn', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleUnfriend = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    if (!window.confirm('Bạn có chắc muốn hủy kết bạn?')) return
    setSocialActionBusy(true)
    try {
      await api.deleteFriend(token, Number(profileId))
      setFriendStatus('none')
      setFriends((prev) => prev.filter((f) => String(f.id) !== profileId))
    } catch (error) {
      console.error('Không thể hủy kết bạn', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleMessageUser = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    setSocialActionBusy(true)
    try {
      const conversations = await api.listConversations(token)
      const existing = conversations.conversations.find(
        (conversation) =>
          conversation.type === 'direct' &&
          conversation.members.some((member) => member.userId === Number(profileId))
      )
      if (existing) {
        navigate(`/messages?conversation=${existing.id}`)
        return
      }
      const created = await api.createDirectConversation(token, Number(profileId))
      navigate(`/messages?conversation=${created.conversation.id}`)
    } catch (error) {
      console.error('Không thể mở hội thoại', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleReportAccount = async (payload: { reason: string; details?: string }) => {
    if (!token || isOwnProfile || !Number(profileId)) return
    await api.submitReport(token, {
      targetType: 'user',
      targetId: profileId,
      reason: payload.reason,
      details: payload.details,
    })
    toast({
      title: 'Đã gửi báo cáo tài khoản',
      description: 'Đội ngũ kiểm duyệt sẽ xem xét tài khoản này và thông báo khi có cập nhật.',
    })
  }

  if (isLoadingProfile && !profileUser) {
    return (
      <div className={styles.page}>
        <section className={styles.cover}>
          <div className={styles.coverGlow}></div>
        </section>
        <div className={styles.shell}>
          <header className={styles.profileHeader}>
            <Skeleton style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Skeleton style={{ width: 180, height: 22 }} />
              <Skeleton style={{ width: 120, height: 16 }} />
            </div>
          </header>
          <div className={styles.grid}>
            <aside className={styles.leftCol}>
              <section className={styles.card}>
                <Skeleton style={{ height: 16, width: '55%', marginBottom: 14 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13 }} />
              </section>
            </aside>
            <section className={styles.rightCol}>
              <Skeleton style={{ height: 176, borderRadius: 16, marginBottom: 12 }} />
              <Skeleton style={{ height: 176, borderRadius: 16 }} />
            </section>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.cover}>
        <div className={styles.coverGlow}></div>
      </section>

      <div className={styles.shell}>
        <header className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {profileAvatar && !profileAvatarBroken ? (
              <img
                src={profileAvatar}
                alt={profileName}
                className={styles.avatar}
                loading="lazy"
                onError={() => setProfileAvatarBroken(true)}
              />
            ) : (
              <div className={styles.avatar}>{initials}</div>
            )}
            {isOnline ? <span className={styles.onlineDot} title="Đang hoạt động" /> : null}
          </div>
          <div className={styles.titleBlock}>
            <h1>{profileName}</h1>
            <p>{roleText}</p>
          </div>
          {isOwnProfile ? (
            <Link to="/profile/edit" className={styles.editBtn}>
              Chỉnh sửa trang cá nhân
            </Link>
          ) : (
            <div className={styles.profileActionGroup}>
              <button type="button" className={styles.editBtn} onClick={handleMessageUser} disabled={socialActionBusy}>
                {socialActionBusy ? 'Đang mở...' : 'Nhắn tin'}
              </button>
              {friendStatus === 'accepted' ? (
                <button type="button" className={styles.followBtn} onClick={handleUnfriend} disabled={socialActionBusy}>
                  Hủy kết bạn
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.followBtn}
                  onClick={handleRequestFriend}
                  disabled={socialActionBusy || friendStatus !== 'none'}
                >
                  {friendStatus === 'pending' ? 'Đã gửi lời mời' : 'Kết bạn'}
                </button>
              )}
              <button type="button" className={styles.reportBtn} onClick={() => setReportAccountOpen(true)}>
                Báo cáo tài khoản
              </button>
            </div>
          )}
        </header>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className={styles.grid}>
          <aside className={styles.leftCol}>
            <section className={styles.card}>
              <h3>Giới thiệu</h3>
              <ul className={styles.infoList}>
                <li><Settings size={16} /> Vai trò: <strong>{roleText}</strong></li>
                <li><Rss size={16} /> Trạng thái: <strong>{accountText}</strong></li>
                <li><Rss size={16} /> Bài viết: <strong>{isLoadingPosts ? '...' : posts.length}</strong></li>
                <li><Rss size={16} /> Tổng tương tác: <strong>{isLoadingPosts ? '...' : totalInteractions}</strong></li>
              </ul>
              {isOwnProfile ? (
                <Link to="/profile/edit" className={styles.lightBtn}>
                  Chỉnh sửa chi tiết
                </Link>
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Ảnh</h3>
                <Link to="/media">Xem tất cả</Link>
              </div>
              <div className={styles.photosGrid}>
                {profileMedia.map((post) => (
                  <img
                    key={post.id}
                    src={post.mediaUrl || ''}
                    alt={`Media ${post.id}`}
                    className={styles.photoImage}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.style.display = 'none' }}
                  />
                ))}
                {!isLoadingPosts && profileMedia.length === 0 ? <p className={styles.empty}>Chưa có ảnh/video.</p> : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Bạn bè</h3>
                <Link to="/friends">Xem tất cả</Link>
              </div>
              <p className={styles.friendsCount}>{acceptedFriends.length} người bạn</p>
              <div className={styles.friendsGrid}>
                {acceptedFriends.slice(0, 6).map((friend) => (
                  <div key={friend.id} className={styles.friendItem}>
                    <Link to={`/profile/${friend.id}`} className={styles.friendLink}>
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.fullName}
                          className={styles.friendAvatarImage}
                          loading="lazy"
                          onError={(event) => { event.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className={styles.friendAvatar}>{(friend.fullName[0] || 'U').toUpperCase()}</div>
                      )}
                      <span>{friend.fullName}</span>
                    </Link>
                  </div>
                ))}
                {acceptedFriends.length === 0 ? <p className={styles.empty}>Chưa có bạn bè nào.</p> : null}
              </div>
            </section>
          </aside>

          <section className={styles.rightCol}>
            <section className={styles.card}>
              <div className={styles.composerTop}>
                <div className={styles.avatarMini}>{initials}</div>
                <button type="button" className={styles.askBtn} onClick={() => navigate(isOwnProfile ? '/feed?compose=1' : '/messages')}>
                  {profileName.split(' ')[0]} ơi, bạn đang nghĩ gì thế?
                </button>
              </div>
              <div className={styles.composerActions}>
                <button type="button" onClick={() => navigate('/feed?compose=1')}>Tạo bài viết</button>
                <button type="button" onClick={() => setActiveTab('photos')}>Ảnh/Video</button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.postsHead}>
                <h3>Bài viết</h3>
                <div className={styles.headActions}>
                  <button type="button" onClick={() => setMediaOnly((c) => !c)}>{mediaOnly ? 'Tất cả' : 'Chỉ media'}</button>
                  <button type="button" onClick={() => navigate(isOwnProfile ? '/feed?compose=1' : `/profile/${profileId}`)}>
                    {isOwnProfile ? 'Tạo bài viết' : 'Làm mới'}
                  </button>
                </div>
              </div>

              <div className={styles.postsList}>
                {isLoadingPosts ? (
                  <p className={styles.empty}>Đang tải bài viết...</p>
                ) : visiblePosts.length === 0 ? (
                  <p className={styles.empty}>Chưa có nội dung phù hợp.</p>
                ) : visiblePosts.map((post) => (
                  <article key={post.id} className={styles.postItem}>
                    <div className={styles.postAuthor}>
                      <div className={styles.avatarMini}>{(post.authorName[0] || 'U').toUpperCase()}</div>
                      <div>
                        <Link to={`/profile/${post.authorId}`} className={styles.postAuthorLink}>
                          <p>{post.authorName}</p>
                        </Link>
                        <span>{new Date(post.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                    <p className={styles.postText}>{post.content}</p>
                    {post.mediaUrl ? (
                      isVideoMediaUrl(post.mediaUrl) ? (
                        <video
                          src={post.mediaUrl}
                          className={styles.postMedia}
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt="Post media"
                          className={styles.postMedia}
                          loading="lazy"
                          onError={(event) => { event.currentTarget.style.display = 'none' }}
                        />
                      )
                    ) : null}
                    {post.sharedPost ? (
                      <Link to={post.sharedPost.unavailable ? `/profile/${post.authorId}` : `/posts/${post.sharedPost.id}`} className={styles.sharedPostBox}>
                        {post.sharedPost.unavailable ? (
                          <p>Bài viết gốc không còn khả dụng.</p>
                        ) : (
                          <>
                            <div className={styles.sharedPostAuthor}>
                              <span>{(post.sharedPost.authorName?.[0] || 'U').toUpperCase()}</span>
                              <b>{post.sharedPost.authorName || 'Người dùng ZChat'}</b>
                            </div>
                            {post.sharedPost.content ? <p>{post.sharedPost.content}</p> : null}
                            {post.sharedPost.mediaUrl ? (
                              isVideoMediaUrl(post.sharedPost.mediaUrl) ? (
                                <video src={post.sharedPost.mediaUrl} controls preload="metadata" style={{ width: '100%', borderRadius: 8 }} />
                              ) : (
                                <img src={post.sharedPost.mediaUrl} alt="Shared post media" loading="lazy" />
                              )
                            ) : null}
                            <small>
                              {Number(post.sharedPost.reactionCount || 0)} cảm xúc · {Number(post.sharedPost.commentCount || 0)} bình luận
                            </small>
                          </>
                        )}
                      </Link>
                    ) : null}
                    <div className={styles.postFoot}>
                      <span>{post.reactionCount} lượt thích</span>
                      <span>{post.commentCount} bình luận</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>
      <ReportDialog
        open={reportAccountOpen}
        onOpenChange={setReportAccountOpen}
        title="Báo cáo tài khoản"
        onSubmit={handleReportAccount}
      />
    </div>
  )
}
