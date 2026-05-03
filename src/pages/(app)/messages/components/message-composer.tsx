import { CirclePlus, File, Image, Paperclip, Send, Smile, Video, X } from 'lucide-react'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

import { EMOJI_SET, STICKER_PACKS } from '@/services/messages/constants'
import { cn } from '@/utils'

type StickerPackName = keyof typeof STICKER_PACKS

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
  activeStickerPack: StickerPackName
  setActiveStickerPack: Dispatch<SetStateAction<StickerPackName>>
  loadedStickerPacks: Record<StickerPackName, boolean>
  setLoadedStickerPacks: Dispatch<SetStateAction<Record<StickerPackName, boolean>>>
  onSendSticker: (sticker: string) => Promise<void> | void
  fileInputRef: RefObject<HTMLInputElement | null>
  imageInputRef: RefObject<HTMLInputElement | null>
  videoInputRef: RefObject<HTMLInputElement | null>
}

const iconButton =
  'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45'

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
  activeStickerPack,
  setActiveStickerPack,
  loadedStickerPacks,
  setLoadedStickerPacks,
  onSendSticker,
  fileInputRef,
  imageInputRef,
  videoInputRef,
}: MessageComposerProps) {
  return (
    <footer className="relative mx-4 mb-4 mt-3 rounded-[14px] border border-slate-300/60 bg-white p-2 shadow-[0_8px_22px_rgba(18,24,30,0.07)]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} aria-label="Dinh kem tep" title="Dinh kem tep" />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} aria-label="Dinh kem anh" title="Dinh kem anh" />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} aria-label="Dinh kem video" title="Dinh kem video" />

      <div className="relative flex min-h-10 min-w-0 items-end gap-1">
        <button type="button" className={iconButton} onClick={handlePickAttachment} disabled={busyUploading} title="Chon tep dinh kem" aria-label="Chon tep dinh kem">
          <CirclePlus size={18} />
        </button>

        {composerMenuOpen ? (
          <div className="absolute bottom-[calc(100%+0.45rem)] left-0 z-30 grid w-[min(250px,calc(100vw-2rem))] gap-1 rounded-xl border border-slate-300/70 bg-white p-1.5 shadow-[0_12px_28px_rgba(12,20,30,0.2)]">
            <button type="button" className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => handlePickAttachmentType('image')}>
              <Image size={16} />
              Gui anh
            </button>
            <button type="button" className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => handlePickAttachmentType('video')}>
              <Video size={16} />
              Gui video
            </button>
            <button type="button" className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => handlePickAttachmentType('file')}>
              <File size={16} />
              Gui tep
            </button>
            <button
              type="button"
              className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setShowEmojiPanel(true)
                setShowStickerPanel(false)
                setComposerMenuOpen(false)
              }}
            >
              <Smile size={16} />
              Chen emoji
            </button>
          </div>
        ) : null}

        <textarea
          className="h-10 min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-2 text-[0.95rem] leading-6 text-slate-900 outline-none placeholder:text-slate-500"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Nhap tin nhan..."
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
          className={iconButton}
          onClick={() => {
            setShowEmojiPanel((prev) => !prev)
            setShowStickerPanel(false)
            setComposerMenuOpen(false)
          }}
          disabled={busyUploading}
          title="Mo bang emoji"
          aria-label="Mo bang emoji"
        >
          <Smile size={16} />
        </button>
        <button type="button" className={iconButton} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chon tep" aria-label="Chon tep">
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={() => {
            setShowEmojiPanel(false)
            setShowStickerPanel((prev) => !prev)
            setComposerMenuOpen(false)
          }}
          disabled={busyUploading}
          title="Mo sticker"
          aria-label="Mo sticker"
        >
          <span className="text-base leading-none">+</span>
        </button>
        {showStickerPanel ? (
          <button type="button" className={iconButton} onClick={() => setShowStickerPanel(false)} title="Dong sticker" aria-label="Dong sticker">
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border-0 bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={handleSend}
          disabled={!message.trim() || isSendingMessage}
          title="Gui tin nhan"
          aria-label="Gui tin nhan"
        >
          <Send size={17} />
        </button>

        {showEmojiPanel ? (
          <div className="absolute bottom-[calc(100%+0.45rem)] right-0 z-30 grid w-[min(260px,calc(100vw-2rem))] grid-cols-6 gap-1.5 rounded-xl border border-slate-300/70 bg-white p-2 shadow-[0_12px_28px_rgba(12,20,30,0.2)]">
            {EMOJI_SET.map((emoji) => (
              <button key={emoji} type="button" className="grid min-h-9 place-items-center rounded-lg bg-slate-100 text-lg hover:bg-slate-200" onClick={() => setMessage(`${message}${emoji}`)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {showStickerPanel ? (
          <div className="absolute bottom-[calc(100%+0.45rem)] right-0 z-30 grid w-[min(280px,calc(100vw-2rem))] grid-cols-6 gap-1.5 rounded-xl border border-slate-300/70 bg-white p-2 shadow-[0_12px_28px_rgba(12,20,30,0.2)]">
            <div className="col-span-full flex gap-1">
              {(Object.keys(STICKER_PACKS) as Array<StickerPackName>).map((packName) => (
                <button
                  key={packName}
                  type="button"
                  className={cn(
                    'min-h-7 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100',
                    packName === activeStickerPack && 'bg-primary text-primary-foreground hover:bg-primary'
                  )}
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
              STICKER_PACKS[activeStickerPack].map((sticker) => (
                <button key={sticker} type="button" className="grid min-h-9 place-items-center rounded-lg bg-slate-100 text-lg hover:bg-slate-200" title="Gui sticker" aria-label="Gui sticker" onClick={() => void onSendSticker(sticker)}>
                  {sticker}
                </button>
              ))
            ) : (
              <p className="col-span-full py-2 text-center text-xs text-slate-500">Dang tai pack {activeStickerPack}...</p>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
