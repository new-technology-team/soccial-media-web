import {
  BadgeCheck,
  BadgeQuestionMark,
  BicepsFlexed,
  CirclePlus,
  File,
  Flame,
  Handshake,
  Heart,
  Image,
  Paperclip,
  PartyPopper,
  Rocket,
  Send,
  Smile,
  SmilePlus,
  Sparkles,
  Star,
  Sticker,
  ThumbsUp,
  Video,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'

import { cn } from '@/utils'
import styles from '../page.module.css'

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
}

type IconInsert = {
  value: string
  label: string
  Icon: LucideIcon
}

const QUICK_ICON_SET: IconInsert[] = [
  { value: ':smile:', label: 'Cười', Icon: Smile },
  { value: ':smile-plus:', label: 'Vui vẻ', Icon: SmilePlus },
  { value: ':like:', label: 'Thích', Icon: ThumbsUp },
  { value: ':love:', label: 'Yêu thích', Icon: Heart },
  { value: ':thanks:', label: 'Cảm ơn', Icon: Handshake },
  { value: ':sparkles:', label: 'Lấp lánh', Icon: Sparkles },
  { value: ':fire:', label: 'Nổi bật', Icon: Flame },
  { value: ':party:', label: 'Ăn mừng', Icon: PartyPopper },
  { value: ':strong:', label: 'Mạnh mẽ', Icon: BicepsFlexed },
  { value: ':rocket:', label: 'Bứt phá', Icon: Rocket },
  { value: ':star:', label: 'Ngôi sao', Icon: Star },
  { value: ':zap:', label: 'Nhanh', Icon: Zap },
]

const ICON_STICKER_PACKS = {
  'Cảm xúc': [
    { value: 'icon:smile', label: 'Cười', Icon: Smile },
    { value: 'icon:smile-plus', label: 'Vui vẻ', Icon: SmilePlus },
    { value: 'icon:heart', label: 'Yêu thích', Icon: Heart },
    { value: 'icon:sparkles', label: 'Lấp lánh', Icon: Sparkles },
  ],
  'Nổi bật': [
    { value: 'icon:flame', label: 'Nổi bật', Icon: Flame },
    { value: 'icon:party', label: 'Ăn mừng', Icon: PartyPopper },
    { value: 'icon:rocket', label: 'Bứt phá', Icon: Rocket },
    { value: 'icon:star', label: 'Ngôi sao', Icon: Star },
  ],
  'Hành động': [
    { value: 'icon:like', label: 'Thích', Icon: ThumbsUp },
    { value: 'icon:thanks', label: 'Cảm ơn', Icon: Handshake },
    { value: 'icon:strong', label: 'Mạnh mẽ', Icon: BicepsFlexed },
    { value: 'icon:zap', label: 'Nhanh', Icon: Zap },
  ],
  'Tiện ích': [
    { value: 'icon:badge-check', label: 'Đã xong', Icon: BadgeCheck },
    { value: 'icon:question', label: 'Cần hỏi', Icon: BadgeQuestionMark },
    { value: 'icon:sticker', label: 'Sticker', Icon: Sticker },
    { value: 'icon:file', label: 'Tệp', Icon: File },
  ],
} satisfies Record<string, IconInsert[]>

type StickerPackName = keyof typeof ICON_STICKER_PACKS

type MessageComposerProps = {
  message: string
  setMessage: (value: string) => void
  handleSend: () => void | Promise<void>
  handleFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  handlePickAttachment: () => void
  handlePickAttachmentType: (type: 'image' | 'video' | 'file') => void
  busyUploading: boolean
  isSendingMessage: boolean
  composerMenuOpen: boolean
  setComposerMenuOpen: Dispatch<SetStateAction<boolean>>
  showEmojiPanel: boolean
  setShowEmojiPanel: Dispatch<SetStateAction<boolean>>
  showStickerPanel: boolean
  setShowStickerPanel: Dispatch<SetStateAction<boolean>>
  onSendSticker: (sticker: string) => Promise<void> | void
  attachmentDraft: AttachmentDraft | null
  onRemoveAttachment: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  imageInputRef: RefObject<HTMLInputElement | null>
  videoInputRef: RefObject<HTMLInputElement | null>
}

const formatFileSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function MessageComposer({
  message,
  setMessage,
  handleSend,
  handleFileSelected,
  handlePickAttachment,
  handlePickAttachmentType,
  busyUploading,
  isSendingMessage,
  composerMenuOpen,
  setComposerMenuOpen,
  showEmojiPanel,
  setShowEmojiPanel,
  showStickerPanel,
  setShowStickerPanel,
  onSendSticker,
  attachmentDraft,
  onRemoveAttachment,
  fileInputRef,
  imageInputRef,
  videoInputRef,
}: MessageComposerProps) {
  const [activeStickerPack, setActiveStickerPack] = useState<StickerPackName>('Cảm xúc')
  const [loadedStickerPacks, setLoadedStickerPacks] = useState<Record<string, boolean>>({ 'Cảm xúc': true })

  return (
    <footer className={styles.composer}>
      <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm tệp" title="Đính kèm tệp" />
      <input ref={imageInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm ảnh" title="Đính kèm ảnh" />
      <input ref={videoInputRef} type="file" accept="video/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm video" title="Đính kèm video" />

      {attachmentDraft ? (
        <div className={styles.attachmentDraft}>
          <div className={styles.attachmentPreview}>
            {attachmentDraft.type === 'image' && attachmentDraft.previewUrl ? (
              <img src={attachmentDraft.previewUrl} alt={attachmentDraft.file.name} />
            ) : attachmentDraft.type === 'video' && attachmentDraft.previewUrl ? (
              <video src={attachmentDraft.previewUrl} muted />
            ) : (
              <File size={18} />
            )}
          </div>
          <div className={styles.attachmentMeta}>
            <strong>{attachmentDraft.file.name}</strong>
            <span>{attachmentDraft.file.type || 'application/octet-stream'} - {formatFileSize(attachmentDraft.file.size)}</span>
          </div>
          <button type="button" className={styles.attachmentRemoveBtn} onClick={onRemoveAttachment} disabled={busyUploading || isSendingMessage} title="Bỏ tệp đính kèm" aria-label="Bỏ tệp đính kèm">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className={styles.composerRow}>
        <button type="button" className={styles.composerIconBtn} onClick={handlePickAttachment} disabled={busyUploading} title="Chọn tệp đính kèm" aria-label="Chọn tệp đính kèm">
          <CirclePlus size={18} />
        </button>

        {composerMenuOpen ? (
          <div className={styles.composerPlusMenu}>
            <button type="button" onClick={() => handlePickAttachmentType('image')}>
              <Image size={16} />
              Gửi ảnh
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('video')}>
              <Video size={16} />
              Gửi video
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('file')}>
              <File size={16} />
              Gửi tệp
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmojiPanel(true)
                setShowStickerPanel(false)
                setComposerMenuOpen(false)
              }}
            >
              <Smile size={16} />
              Chèn icon
            </button>
          </div>
        ) : null}

        <textarea
          className={styles.composerTextarea}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={attachmentDraft ? 'Nhập chú thích...' : 'Nhập tin nhắn...'}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />

        <button
          type="button"
          className={styles.composerIconBtn}
          onClick={() => {
            setShowEmojiPanel((prev) => !prev)
            setShowStickerPanel(false)
            setComposerMenuOpen(false)
          }}
          disabled={busyUploading}
          title="Mở bảng icon"
          aria-label="Mở bảng icon"
        >
          <Smile size={16} />
        </button>
        <button type="button" className={styles.composerIconBtn} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chọn tệp" aria-label="Chọn tệp">
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          className={styles.composerIconBtn}
          onClick={() => {
            setShowEmojiPanel(false)
            setShowStickerPanel((prev) => !prev)
            setComposerMenuOpen(false)
          }}
          disabled={busyUploading}
          title="Mở sticker"
          aria-label="Mở sticker"
        >
          <Sticker size={16} />
        </button>
        {showStickerPanel ? (
          <button type="button" className={styles.composerIconBtn} onClick={() => setShowStickerPanel(false)} title="Đóng sticker" aria-label="Đóng sticker">
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.composerSendBtn}
          onClick={handleSend}
          disabled={(!message.trim() && !attachmentDraft) || isSendingMessage || busyUploading}
          title="Gửi tin nhắn"
          aria-label="Gửi tin nhắn"
        >
          <Send size={17} />
        </button>

        {showEmojiPanel ? (
          <div className={styles.emojiPanel}>
            {QUICK_ICON_SET.map((item) => (
              <button key={item.value} type="button" title={item.label} aria-label={item.label} onClick={() => setMessage(`${message}${item.value}`)}>
                <item.Icon size={18} />
              </button>
            ))}
          </div>
        ) : null}

        {showStickerPanel ? (
          <div className={styles.stickerPanel}>
            <div className={styles.stickerTabs}>
              {(Object.keys(ICON_STICKER_PACKS) as Array<StickerPackName>).map((packName) => (
                <button
                  key={packName}
                  type="button"
                  className={cn(packName === activeStickerPack && styles.stickerTabActive)}
                  onClick={() => {
                    setActiveStickerPack(packName)
                    if (!loadedStickerPacks[packName]) {
                      setTimeout(() => {
                        setLoadedStickerPacks((prev) => ({ ...prev, [packName]: true }))
                      }, 220)
                    }
                  }}
                >
                  {packName}
                </button>
              ))}
            </div>
            {loadedStickerPacks[activeStickerPack] ? (
              ICON_STICKER_PACKS[activeStickerPack].map((sticker) => (
                <button key={sticker.value} type="button" title={sticker.label} aria-label={sticker.label} onClick={() => void onSendSticker(sticker.value)}>
                  <sticker.Icon size={20} />
                </button>
              ))
            ) : (
              <p className={styles.stickerLoading}>Đang tải bộ {activeStickerPack}...</p>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
