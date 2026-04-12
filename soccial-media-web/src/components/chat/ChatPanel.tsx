import {
  Bell,
  FileText,
  Image as ImageIcon,
  Info,
  MessageCircle,
  Music,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Video,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ChatMessage } from "../../types";
import type { Conversation } from "../../types";
import type { AuthUser } from "../../types";

type MessageType = "text" | "image" | "video" | "audio" | "file" | "sticker";

type Props = {
  profile: AuthUser;
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  messageInput: string;
  setMessageInput: (v: string) => void;
  messageType: MessageType;
  setMessageType: (v: MessageType) => void;
  chatFile: File | null;
  setChatFile: (f: File | null) => void;
  searchKeyword: string;
  setSearchKeyword: (v: string) => void;
  searchResults: ChatMessage[];
  typingState: Record<number, string>;
  isSearchOpen: boolean;
  setIsSearchOpen: (v: boolean) => void;
  isConversationInfoOpen: boolean;
  setIsConversationInfoOpen: (v: boolean) => void;
  isLastOutgoingSeen: boolean;
  onSearchMessages: () => void;
  onSendMessage: () => void;
  onToggleConversationNotify: () => void;
  onMarkSeen: () => void;
  chatFileInputRef: React.RefObject<HTMLInputElement>;
};

export function ChatPanel({
  profile,
  selectedConversation,
  messages,
  messageInput,
  setMessageInput,
  messageType,
  setMessageType,
  chatFile,
  setChatFile,
  searchKeyword,
  setSearchKeyword,
  searchResults,
  typingState,
  isSearchOpen,
  setIsSearchOpen,
  isConversationInfoOpen,
  setIsConversationInfoOpen,
  isLastOutgoingSeen,
  onSearchMessages,
  onSendMessage,
  onToggleConversationNotify,
  chatFileInputRef,
}: Props) {
  const peer = selectedConversation?.type === "direct"
    ? selectedConversation.members.find((m) => m.userId !== profile.id)
    : null;
  const convName = !selectedConversation
    ? ""
    : selectedConversation.type === "group"
      ? selectedConversation.name || `Nhóm ${selectedConversation.id}`
      : peer?.fullName || `Direct ${selectedConversation.id}`;
  const convAvatar = selectedConversation?.avatarUrl || peer?.avatarUrl || null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      {!selectedConversation ? (
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-slate-500">Chọn hội thoại để bắt đầu nhắn tin.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {convAvatar ? (
                  <img src={convAvatar} alt={convName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-200 to-brand-300 text-sm font-bold text-brand-900">
                    {(convName || "C").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">{convName}</h3>
                <p className="text-xs text-slate-500">
                  {selectedConversation.type === "group"
                    ? `${selectedConversation.members.length} thành viên`
                    : peer
                      ? "Đang hoạt động"
                      : "Không rõ"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`rounded-lg border p-2 text-xs transition ${isSearchOpen ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 hover:border-brand-300"}`}
                type="button"
                title="Tìm kiếm tin nhắn"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
              >
                <Search size={16} />
              </button>
              <button
                className={`rounded-lg border p-2 text-xs transition ${isConversationInfoOpen ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 hover:border-brand-300"}`}
                type="button"
                title="Thông tin hội thoại"
                onClick={() => setIsConversationInfoOpen(!isConversationInfoOpen)}
              >
                <Info size={16} />
              </button>
              <button
                className="rounded-lg border border-slate-300 p-2 text-xs transition hover:border-brand-300"
                type="button"
                title={selectedConversation.notificationsEnabled ? "Tắt thông báo" : "Bật thông báo"}
                onClick={onToggleConversationNotify}
              >
                <Bell size={16} />
              </button>
            </div>
          </div>

          {isSearchOpen && (
            <div className="mb-3 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <input
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Tìm tin nhắn theo từ khóa"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <button
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                type="button"
                onClick={onSearchMessages}
              >
                Tìm
              </button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mb-3 max-h-28 overflow-auto rounded-xl bg-slate-50 p-2 text-xs text-slate-700">
              {searchResults.slice(0, 8).map((item) => (
                <div key={item.id}>#{item.id} {item.senderName}: {item.text || item.type}</div>
              ))}
            </div>
          )}

          <div className="mb-3 max-h-[360px] space-y-2 overflow-auto rounded-xl bg-slate-100 p-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-500">Chưa có tin nhắn.</p>
            )}
            {messages.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.senderId === profile.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-[15px] leading-6 shadow-sm ${item.senderId === profile.id ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
                >
                  <div className={`mb-1 text-[11px] ${item.senderId === profile.id ? "text-brand-100" : "text-slate-500"}`}>
                    {item.senderName}
                  </div>
                  <div>
                    {item.type === "text" && (item.text || "")}
                    {item.type === "sticker" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900">
                        <Smile size={12} /> {item.meta?.sticker || "sticker"}
                      </span>
                    )}
                    {item.type === "image" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-sky-900">
                        <ImageIcon size={12} /> Ảnh
                      </span>
                    )}
                    {item.type === "video" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-violet-900">
                        <Video size={12} /> Video
                      </span>
                    )}
                    {item.type === "audio" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900">
                        <Music size={12} /> Audio
                      </span>
                    )}
                    {item.type === "file" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-orange-900">
                        <FileText size={12} /> Tệp
                      </span>
                    )}
                    {item.type !== "text" && item.text && (
                      <div className="mt-1 text-sm">{item.text}</div>
                    )}
                  </div>
                  {item.mediaUrl && (
                    <a
                      className={`mt-1 block text-xs underline ${item.senderId === profile.id ? "text-white" : "text-brand-700"}`}
                      href={item.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở file đính kèm
                    </a>
                  )}
                </div>
              </div>
            ))}
            {typingState[selectedConversation.id] && (
              <div className="text-xs text-brand-700">
                {typingState[selectedConversation.id]}
              </div>
            )}
          </div>

          {selectedConversation.type === "direct" && (
            <div className="mb-2 text-right text-xs text-slate-500">
              {isLastOutgoingSeen ? "Đã xem" : "Đã gửi"}
            </div>
          )}

          {isConversationInfoOpen && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Thông tin hội thoại</h4>
              <div className="mb-3 text-xs text-slate-600">
                <div>ID: {selectedConversation.id}</div>
                <div>Loại: {selectedConversation.type}</div>
                <div>Thông báo: {selectedConversation.notificationsEnabled ? "Bật" : "Tắt"}</div>
              </div>
              <p className="text-xs text-slate-500">Quản lý thành viên: sắp có.</p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <div className="mb-2 flex items-center gap-2">
              {(
                [
                  { type: "text", Icon: MessageCircle, title: "Tin nhắn văn bản" },
                  { type: "sticker", Icon: Smile, title: "Sticker" },
                  { type: "image", Icon: ImageIcon, title: "Ảnh" },
                  { type: "video", Icon: Video, title: "Video" },
                  { type: "audio", Icon: Music, title: "Audio" },
                  { type: "file", Icon: FileText, title: "Tệp" },
                ] as const
              ).map((item) => (
                <button
                  key={item.type}
                  className={`h-8 w-8 rounded-lg text-sm ${messageType === item.type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                  type="button"
                  title={item.title}
                  onClick={() => {
                    setMessageType(item.type);
                    if (item.type === "text") setChatFile(null);
                  }}
                >
                  <item.Icon size={16} />
                </button>
              ))}
              <button
                className="h-8 w-8 rounded-lg bg-slate-100 px-2 text-xs text-slate-700"
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                title="Chọn tệp đính kèm"
              >
                <Paperclip size={14} />
              </button>
              {chatFile && (
                <span className="truncate text-xs text-slate-600">{chatFile.name}</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={messageType === "text" ? "Nhập tin nhắn..." : "Nhập ghi chú (tùy chọn)..."}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <input
                ref={chatFileInputRef}
                className="hidden"
                type="file"
                aria-label="Đính kèm file chat"
                title="Đính kèm file chat"
                onChange={(e) => setChatFile(e.target.files?.[0] || null)}
              />
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={onSendMessage}
                title="Gửi tin nhắn"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
