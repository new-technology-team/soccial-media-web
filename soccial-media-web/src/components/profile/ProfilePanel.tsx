import { FileText, Image as ImageIcon, Music, Paperclip, Plus, Send, Smile, Video } from "lucide-react";
import type { ChatMessage } from "../../types";
import type { Conversation } from "../../types";
import type { AuthUser } from "../../types";

type MessageType = "text" | "image" | "video" | "audio" | "file" | "sticker";
type Gender = "male" | "female" | "other";

type Props = {
  profile: AuthUser;
  avatarUrl: string;
  setAvatarUrl: (v: string) => void;
  avatarFile: File | null;
  setAvatarFile: (f: File | null) => void;
  fullName: string;
  setFullName: (v: string) => void;
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  gender: Gender | "";
  setGender: (v: Gender | "") => void;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newAuthPassword: string;
  setNewAuthPassword: (v: string) => void;
  isLoading: boolean;
  isUploadingAvatar: boolean;
  onUpdateProfile: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
};

export function ProfilePanel({
  profile,
  avatarUrl,
  fullName,
  dateOfBirth,
  gender,
  currentPassword,
  newAuthPassword,
  isLoading,
  isUploadingAvatar,
  onUpdateProfile,
  onChangePassword,
  onLogout,
}: Props) {
  return (
    <aside className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl ring-1 ring-brand-100">
      <h2 className="mb-4 text-xl font-semibold text-brand-900">Hồ sơ cá nhân</h2>
      <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        <div>Email/SĐT: {profile.email || profile.phone || "N/A"}</div>
        <div>Xác thực: {profile.isVerified ? "Đã xác thực" : "Chưa xác thực"}</div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Họ tên</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
            aria-label="Họ tên hồ sơ"
            title="Họ tên hồ sơ"
            placeholder="Nhập họ tên"
            value={fullName}
            onChange={(e) => {}}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Ngày sinh</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
            type="date"
            aria-label="Ngày sinh hồ sơ"
            title="Ngày sinh hồ sơ"
            value={dateOfBirth}
            onChange={(e) => {}}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Giới tính</label>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
            aria-label="Giới tính hồ sơ"
            title="Giới tính hồ sơ"
            value={gender}
            onChange={(e) => {}}
          >
            <option value="">Chưa chọn</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Ảnh đại diện</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
            type="file"
            accept="image/*"
            aria-label="Ảnh đại diện trong hồ sơ"
            title="Chọn ảnh đại diện mới"
            onChange={(e) => {}}
          />
          {profile.avatarUrl && (
            <p className="mt-1 text-xs text-slate-500">Ảnh hiện tại đã có trên S3.</p>
          )}
        </div>
      </div>

      <button
        className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        type="button"
        onClick={onUpdateProfile}
        disabled={isLoading || isUploadingAvatar}
      >
        {isUploadingAvatar ? "Đang tải ảnh lên S3..." : "Cập nhật hồ sơ"}
      </button>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="mb-2 text-base font-semibold text-brand-900">Đổi mật khẩu</h3>
        <input
          className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
          type="password"
          placeholder="Mật khẩu hiện tại"
          value={currentPassword}
          onChange={(e) => {}}
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
          type="password"
          placeholder="Mật khẩu mới"
          value={newAuthPassword}
          onChange={(e) => {}}
        />
        <button
          className="mt-3 w-full rounded-xl border border-brand-700 px-4 py-2.5 font-semibold text-brand-700"
          type="button"
          onClick={onChangePassword}
          disabled={isLoading}
        >
          Đổi mật khẩu
        </button>
      </div>
    </aside>
  );
}
