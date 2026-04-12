import type { AppNotification } from "../../types";

type Props = {
  notifications: AppNotification[];
  onReadNotification: (id: number) => void;
  onReadAllNotifications: () => void;
};

const parseMeta = (metaJson?: string | null) => {
  if (!metaJson) return null;
  try { return JSON.parse(metaJson); } catch { return null; }
};

export function NotificationsPanel({ notifications, onReadNotification, onReadAllNotifications }: Props) {
  return (
    <div>
      <button
        className="mb-3 rounded-xl border border-brand-300 px-3 py-2 text-sm"
        type="button"
        onClick={onReadAllNotifications}
      >
        Đánh dấu đã đọc tất cả
      </button>
      <div className="space-y-2">
        {notifications.length === 0 && (
          <p className="text-sm text-slate-500">Không có thông báo nào.</p>
        )}
        {notifications.map((item) => {
          const meta = parseMeta(item.meta_json);
          const requesterId = meta ? Number(meta.requesterId || 0) : 0;
          return (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="font-semibold text-slate-800">{item.title}</div>
              <div className="text-slate-600">{item.body || "(không có nội dung)"}</div>
              <div className="mt-1 text-xs text-slate-500">
                {new Date(item.created_at).toLocaleString()}
              </div>
              {item.type === "friend-request" && requesterId > 0 && (
                <button
                  className="mt-2 mr-2 rounded-lg border border-emerald-300 px-2 py-1 text-xs"
                  type="button"
                  onClick={() => onReadNotification(item.id)}
                >
                  Chấp nhận kết bạn
                </button>
              )}
              {!item.is_read && (
                <button
                  className="mt-2 rounded-lg border border-brand-300 px-2 py-1 text-xs"
                  type="button"
                  onClick={() => onReadNotification(item.id)}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
