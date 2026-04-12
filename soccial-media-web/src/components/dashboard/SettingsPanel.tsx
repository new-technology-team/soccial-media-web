import type { UserSettings } from "../../types";

type Props = {
  settings: UserSettings;
  onUpdateSettings: (next: Partial<UserSettings>) => void;
};

export function SettingsPanel({ settings, onUpdateSettings }: Props) {
  const rows: Array<{ key: keyof UserSettings; label: string }> = [
    { key: "privacyLastSeen", label: "Hiển thị trạng thái online" },
    { key: "privacyProfilePhoto", label: "Hiển thị ảnh đại diện" },
    { key: "allowFriendRequests", label: "Cho phép gửi lời mời kết bạn" },
    { key: "notificationMessages", label: "Nhận thông báo tin nhắn" },
    { key: "notificationCalls", label: "Nhận thông báo cuộc gọi" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <label
          key={row.key}
          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
        >
          <span>{row.label}</span>
          <input
            type="checkbox"
            checked={Boolean(settings[row.key])}
            onChange={(e) => onUpdateSettings({ [row.key]: e.target.checked } as Partial<UserSettings>)}
          />
        </label>
      ))}
    </div>
  );
}
