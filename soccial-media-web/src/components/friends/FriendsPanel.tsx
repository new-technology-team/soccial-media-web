import type { FriendItem } from "../../types";

type Props = {
  friends: FriendItem[];
  onlineUsers: Record<number, boolean>;
  userSearchKeyword: string;
  setUserSearchKeyword: (v: string) => void;
  userSearchResults: Array<{
    id: number;
    full_name: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  }>;
  onSearchUsers: () => void;
  onRequestFriend: (userId: number) => void;
  onStartChatWithUser: (userId: number) => void;
  onAcceptFriend: (userId: number) => void;
  onRemoveFriend: (userId: number) => void;
};

export function FriendsPanel({
  friends,
  onlineUsers,
  userSearchKeyword,
  setUserSearchKeyword,
  userSearchResults,
  onSearchUsers,
  onRequestFriend,
  onStartChatWithUser,
  onAcceptFriend,
  onRemoveFriend,
}: Props) {
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Tìm user theo tên/email/sđt (ví dụ: 0912...)"
          value={userSearchKeyword}
          onChange={(e) => setUserSearchKeyword(e.target.value)}
        />
        <button
          className="rounded-xl border border-brand-300 px-3 py-2 text-sm"
          type="button"
          onClick={onSearchUsers}
        >
          Tìm
        </button>
      </div>

      {userSearchResults.length > 0 && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <h3 className="mb-2 text-sm font-semibold">Kết quả tìm user</h3>
          {userSearchResults.map((user) => (
            <div
              key={user.id}
              className="mb-2 flex items-center justify-between rounded-lg bg-white p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                  ) : (
                    (user.full_name || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-semibold">{user.full_name}</div>
                  <div className="text-xs text-slate-500">
                    ID: {user.id} · {user.email || user.phone || "N/A"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-brand-300 px-2 py-1 text-xs"
                  type="button"
                  onClick={() => onRequestFriend(user.id)}
                >
                  Kết bạn
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  type="button"
                  onClick={() => onStartChatWithUser(user.id)}
                >
                  Nhắn tin
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-slate-50 p-3">
        <h3 className="mb-2 text-sm font-semibold">Danh sách bạn bè</h3>
        {friends.length === 0 && (
          <p className="text-sm text-slate-500">Chưa có bạn bè.</p>
        )}
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="mb-2 flex items-center justify-between rounded-lg bg-white p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {friend.avatarUrl ? (
                    <img src={friend.avatarUrl} alt={friend.fullName} className="h-full w-full object-cover" />
                  ) : (
                    (friend.fullName || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white ${onlineUsers[friend.id] ? "bg-emerald-500" : "bg-slate-300"}`}
                />
              </div>
              <div>
                <div className="font-semibold">{friend.fullName}</div>
                <div className="text-xs text-slate-500">
                  {onlineUsers[friend.id] ? "Online" : "Offline"} · {friend.status}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                type="button"
                onClick={() => onStartChatWithUser(friend.id)}
              >
                Nhắn tin
              </button>
              {friend.status === "pending" && !friend.requestedByMe && (
                <button
                  className="rounded-lg border border-brand-300 px-2 py-1 text-xs"
                  type="button"
                  onClick={() => onAcceptFriend(friend.id)}
                >
                  Chấp nhận
                </button>
              )}
              <button
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                type="button"
                onClick={() => onRemoveFriend(friend.id)}
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
