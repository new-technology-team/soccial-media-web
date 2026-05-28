'use client'

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, ImagePlus, UploadCloud } from 'lucide-react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import styles from './page.module.css'

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đại diện'))
    reader.readAsDataURL(file)
  })

const cropAvatarToBase64 = (dataUrl: string, zoom: number, cropX: number, cropY: number) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const size = 512
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Không thể xử lý ảnh'))
        return
      }
      canvas.width = size
      canvas.height = size
      context.fillStyle = '#f8fafc'
      context.fillRect(0, 0, size, size)

      const scale = Math.max(size / image.width, size / image.height) * zoom
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const maxX = Math.max(0, (drawWidth - size) / 2)
      const maxY = Math.max(0, (drawHeight - size) / 2)
      const dx = (size - drawWidth) / 2 + (cropX / 100) * maxX
      const dy = (size - drawHeight) / 2 + (cropY / 100) * maxY
      context.drawImage(image, dx, dy, drawWidth, drawHeight)
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1] || '')
    }
    image.onerror = () => reject(new Error('Ảnh không hợp lệ'))
    image.src = dataUrl
  })

export default function EditProfilePage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const [fullName, setFullName] = useState(me?.fullName || '')
  const [username, setUsername] = useState((me?.fullName || '').toLowerCase().replace(/\s+/g, '.'))
  const [bio, setBio] = useState('Nhà sáng tạo nội dung số, tập trung vào trải nghiệm tối giản và rõ ràng.')
  const [profilePublic, setProfilePublic] = useState(true)
  const [showActivity, setShowActivity] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || '')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [avatarFileName, setAvatarFileName] = useState('avatar.jpg')
  const [avatarZoom, setAvatarZoom] = useState(1)
  const [avatarCropX, setAvatarCropX] = useState(0)
  const [avatarCropY, setAvatarCropY] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [busyUpload, setBusyUpload] = useState(false)
  const [message, setMessage] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!token) return
    api.getSettings(token)
      .then((response) => {
        setProfilePublic(Boolean(response.settings.privacyProfilePhoto))
        setShowActivity(Boolean(response.settings.privacyLastSeen))
      })
      .catch(() => undefined)
  }, [token])

  const handleSelectAvatar = () => avatarInputRef.current?.click()

  const prepareAvatar = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'File không hợp lệ', description: 'Vui lòng chọn một ảnh đại diện.', variant: 'destructive' })
      return
    }
    const dataUrl = await fileToDataUrl(file)
    setAvatarDraft(dataUrl)
    setAvatarFileName(file.name || 'avatar.jpg')
    setAvatarZoom(1)
    setAvatarCropX(0)
    setAvatarCropY(0)
    setMessage('Ảnh đã sẵn sàng. Căn crop rồi bấm Lưu ảnh đại diện.')
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await prepareAvatar(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    await prepareAvatar(event.dataTransfer.files?.[0])
  }

  const uploadAvatarDraft = async () => {
    if (!avatarDraft || !token) return
    setBusyUpload(true)
    try {
      const base64Data = await cropAvatarToBase64(avatarDraft, avatarZoom, avatarCropX, avatarCropY)
      const response = await fetch('/backend/api/auth/avatar-upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: avatarFileName,
          contentType: 'image/jpeg',
          base64Data,
        }),
      })
      const uploaded = await response.json().catch(() => ({}))

      if (!response.ok || (!uploaded.mediaUrl && !uploaded.fileUrl && !uploaded.avatarUrl)) {
        throw new Error(uploaded.message || 'Upload avatar thất bại')
      }

      const nextAvatarUrl = uploaded.mediaUrl || uploaded.fileUrl || uploaded.avatarUrl
      const resolvedAvatarUrl = String(nextAvatarUrl).startsWith('/uploads/')
        ? `/backend${nextAvatarUrl}`
        : nextAvatarUrl
      setAvatarUrl(resolvedAvatarUrl)
      setAvatarDraft('')
      if (uploaded.user && refreshToken) {
        setAuth({
          accessToken: token,
          refreshToken,
          user: {
            ...uploaded.user,
            avatarUrl: resolvedAvatarUrl,
          },
        })
      }
      setMessage('Đã tải ảnh đại diện mới.')
      toast({ title: 'Đã cập nhật ảnh đại diện', description: 'Avatar đã đồng bộ tới navbar, chat và bình luận.' })
    } catch (error) {
      console.error(error)
      setMessage(error instanceof Error ? error.message : 'Không thể tải ảnh đại diện.')
      toast({ title: 'Không thể tải ảnh đại diện', description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setBusyUpload(false)
    }
  }

  const handleSave = async () => {
    if (!token || !me || !refreshToken) {
      setMessage('Phiên đăng nhập không hợp lệ.')
      return
    }

    setBusySave(true)
    try {
      const response = await api.updateProfile(token, {
        fullName: fullName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      })
      await api.saveSettings(token, {
        privacyProfilePhoto: profilePublic,
        privacyLastSeen: showActivity,
      })

      setAuth({
        accessToken: token,
        refreshToken,
        user: response.user,
      })

      setMessage('Lưu thay đổi thành công.')
      toast({ title: 'Đã lưu hồ sơ', description: 'Thông tin hồ sơ đã được cập nhật.' })
      navigate(`/profile/${response.user.id}`)
    } catch (error) {
      console.error(error)
      setMessage('Không thể lưu hồ sơ. Vui lòng thử lại.')
      toast({ title: 'Không thể lưu hồ sơ', description: 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setBusySave(false)
    }
  }

  const previewAvatar = avatarDraft || avatarUrl

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Profile studio</p>
          <h1>Chỉnh sửa hồ sơ</h1>
        </div>
        <div className={styles.actions}>
          <Link to={me ? `/profile/${me.id}` : '/feed'} className={styles.cancelBtn}>
            Hủy
          </Link>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={busySave || busyUpload}>
            {busySave ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </header>

      <section className={styles.cover}>
        <div className={styles.coverText}>
          <span>Cover photo</span>
          <strong>{fullName || me?.fullName || 'ZChat user'}</strong>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
        <button type="button" className={styles.avatarButton} onClick={handleSelectAvatar}>
          {previewAvatar ? (
            <img
              src={previewAvatar}
              alt="avatar"
              className={styles.avatarImage}
              style={avatarDraft ? { transform: `scale(${avatarZoom})`, objectPosition: `${50 + avatarCropX / 2}% ${50 + avatarCropY / 2}%` } : undefined}
            />
          ) : (
            <div className={styles.avatar}>{(me?.fullName?.[0] || 'U').toUpperCase()}</div>
          )}
          <span><Camera size={14} /> Đổi ảnh</span>
        </button>
      </section>

      <section
        className={`${styles.uploadPanel} ${dragActive ? styles.uploadPanelActive : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div>
          <UploadCloud size={20} />
          <b>Kéo thả ảnh đại diện vào đây</b>
          <small>Chọn ảnh, xem preview, căn crop rồi lưu. Ảnh chỉ upload khi bạn xác nhận.</small>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={handleSelectAvatar}><ImagePlus size={16} /> Chọn ảnh</button>
      </section>

      {avatarDraft ? (
        <section className={styles.cropPanel}>
          <div className={styles.cropPreview}>
            <img src={avatarDraft} alt="Avatar preview" style={{ transform: `scale(${avatarZoom})`, objectPosition: `${50 + avatarCropX / 2}% ${50 + avatarCropY / 2}%` }} />
          </div>
          <div className={styles.cropControls}>
            <label>Zoom<input type="range" min="1" max="2.4" step="0.05" value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} /></label>
            <label>Ngang<input type="range" min="-100" max="100" value={avatarCropX} onChange={(event) => setAvatarCropX(Number(event.target.value))} /></label>
            <label>Dọc<input type="range" min="-100" max="100" value={avatarCropY} onChange={(event) => setAvatarCropY(Number(event.target.value))} /></label>
            <div className={styles.cropActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setAvatarDraft('')}>Bỏ ảnh</button>
              <button type="button" className={styles.saveBtn} disabled={busyUpload} onClick={() => void uploadAvatarDraft()}>{busyUpload ? 'Đang upload...' : 'Lưu ảnh đại diện'}</button>
            </div>
          </div>
        </section>
      ) : null}

      {message ? <p className={styles.notice}>{message}</p> : null}

      <div className={styles.layout}>
        <section className={styles.mainCol}>
          <article className={styles.card}>
            <h2>Thông tin cơ bản</h2>
            <div className={styles.formGrid}>
              <label>
                <span>Họ và tên</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label>
                <span>Tên hiển thị</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </label>
              <label className={styles.fullWidth}>
                <span>Tiểu sử</span>
                <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
              </label>
              <label>
                <span>Giới tính</span>
                <select defaultValue="Khác">
                  <option>Khác</option>
                  <option>Nam</option>
                  <option>Nữ</option>
                  <option>Không tiết lộ</option>
                </select>
              </label>
              <label>
                <span>Ngày sinh</span>
                <input type="date" defaultValue="1994-08-12" />
              </label>
            </div>
          </article>

          <article className={styles.card}>
            <h2>Bảo mật tài khoản</h2>
            <div className={styles.securityItem}>
              <div>
                <b>Đổi mật khẩu</b>
                <small>Cập nhật gần nhất 3 tháng trước</small>
              </div>
              <button type="button">Cập nhật mật khẩu</button>
            </div>
          </article>
        </section>

        <aside className={styles.sideCol}>
          <article className={styles.card}>
            <h3>Xem trước hồ sơ</h3>
            <div className={styles.previewCard}>
              {previewAvatar ? <img src={previewAvatar} alt="preview avatar" /> : <div>{(fullName?.[0] || 'U').toUpperCase()}</div>}
              <b>{fullName || 'Tên hiển thị'}</b>
              <small>@{username || 'username'}</small>
              <p>{bio}</p>
            </div>
          </article>

          <article className={styles.card}>
            <h3>Quyền riêng tư hồ sơ</h3>
            <div className={styles.switchRow}>
              <span>Hồ sơ công khai</span>
              <label className={styles.switch}><input type="checkbox" checked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} /><span></span></label>
            </div>
            <div className={styles.switchRow}>
              <span>Hiện hoạt động</span>
              <label className={styles.switch}><input type="checkbox" checked={showActivity} onChange={(e) => setShowActivity(e.target.checked)} /><span></span></label>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}
