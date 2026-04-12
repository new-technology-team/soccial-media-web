import type { Conversation } from "../../types";

type Props = {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  profileId?: number;
  onlineUsers: Record<number, boolean>;
  onSelect: (c: Conversation) => void;
};

export function ConversationList({
  conversations,
  selectedConversation,
  profileId,
  onlineUsers,
  onSelect,
}: Props) {
  return (
    <div className="max-h-[420px] space-y-2 overflow-auto">
      {conversations.length === 0 && (
        <p className="text-sm text-slate-500">Chưa có hội thoại nào.</p>
      )}
      {conversations.map((thread) => {
        const threadName =
          thread.type === "group"
            ? thread.name || `Nhóm ${thread.id}`
            : thread.members.find((m) => m.userId !== profileId)?.fullName ||
              `Direct ${thread.id}`;

        return (
          <button
            key={thread.id}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${selectedConversation?.id === thread.id ? "border-brand-400 bg-brand-50 shadow-sm" : "border-slate-200 bg-white hover:border-brand-200"}`}
            type="button"
            onClick={() => onSelect(thread)}
          >
            <div className="font-semibold text-slate-800">{threadName}</div>
            <div className="text-xs text-slate-500">
              {thread.lastMessage?.text ||
                thread.lastMessage?.type ||
                "Chưa có tin nhắn"}
            </div>
            {thread.unreadCount > 0 && (
              <div className="mt-1 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[11px] text-white">
                {thread.unreadCount}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
