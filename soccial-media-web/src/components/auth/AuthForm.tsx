import type { Mode } from "../../pages/AuthPage";

type Props = {
  mode: Mode;
  emailOrPhone: string;
  setEmailOrPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  gender: string;
  setGender: (v: "male" | "female" | "other" | "") => void;
  avatarFile: File | null;
  setAvatarFile: (f: File | null) => void;
  code: string;
  setCode: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onResendVerification: () => void;
  onSwitchMode: (m: Mode) => void;
  message: string;
};

export function AuthForm({
  mode,
  emailOrPhone,
  setEmailOrPhone,
  password,
  setPassword,
  fullName,
  setFullName,
  dateOfBirth,
  setDateOfBirth,
  gender,
  setGender,
  avatarFile,
  setAvatarFile,
  code,
  setCode,
  newPassword,
  setNewPassword,
  isLoading,
  onSubmit,
  onResendVerification,
  onSwitchMode,
  message,
}: Props) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <h2 className="text-2xl font-semibold text-brand-900">
        {mode === "register"
          ? "Đăng ký"
          : mode === "verify"
            ? "Xác thực OTP"
            : mode === "forgot"
              ? "Quên mật khẩu"
              : mode === "reset"
                ? "Đặt lại mật khẩu"
                : "Đăng nhập"}
      </h2>

      {mode === "verify" ? (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Email hoặc số điện thoại
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="text"
              placeholder="email@example.com hoặc 0912345678"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Mã OTP</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              placeholder="Nhập mã OTP"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
        </>
      ) : mode === "forgot" ? (
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Email hoặc số điện thoại
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            type="text"
            placeholder="email@example.com hoặc 0912345678"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
          />
        </div>
      ) : mode === "reset" ? (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Email hoặc số điện thoại
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="text"
              placeholder="email@example.com hoặc 0912345678"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Mã đặt lại</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              placeholder="Nhập mã đặt lại"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Mật khẩu mới
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="password"
              placeholder="Mật khẩu mới (6-72 ký tự)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Email hoặc số điện thoại
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="text"
              placeholder="email@example.com hoặc 0912345678"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              required
            />
          </div>

          {mode === "register" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Họ tên (không bắt buộc)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Ngày sinh (không bắt buộc)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                  type="date"
                  aria-label="Ngày sinh"
                  title="Ngày sinh"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Giới tính (không bắt buộc)
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                  aria-label="Giới tính"
                  title="Giới tính"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "male" | "female" | "other" | "")}
                >
                  <option value="">Chưa chọn</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Ảnh đại diện (thêm sau khi đăng nhập)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                  type="file"
                  accept="image/*"
                  aria-label="Ảnh đại diện"
                  title="Chọn ảnh đại diện"
                  onChange={(e) =>
                    setAvatarFile(e.target.files?.[0] || null)
                  }
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm text-slate-600">Mật khẩu</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      )}

      <button
        className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        disabled={isLoading}
        type="submit"
      >
        {isLoading
          ? "Đang xử lý..."
          : mode === "register"
            ? "Đăng ký"
            : mode === "verify"
              ? "Xác thực"
              : mode === "forgot"
                ? "Gửi yêu cầu"
                : mode === "reset"
                  ? "Đặt lại mật khẩu"
                  : "Đăng nhập"}
      </button>

      {mode === "login" && (
        <button
          className="w-full text-sm font-medium text-brand-700 underline"
          type="button"
          onClick={() => onSwitchMode("forgot")}
        >
          Quên mật khẩu?
        </button>
      )}

      {mode === "verify" && (
        <button
          className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700"
          type="button"
          onClick={onResendVerification}
          disabled={isLoading}
        >
          Gửi lại mã OTP
        </button>
      )}

      {mode === "forgot" && (
        <button
          className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700"
          type="button"
          onClick={() => onSwitchMode("reset")}
        >
          Tôi đã có mã đặt lại
        </button>
      )}

      {(mode === "forgot" || mode === "reset" || mode === "verify") && (
        <button
          className="w-full text-sm font-medium text-slate-600 underline"
          type="button"
          onClick={() => onSwitchMode("login")}
        >
          Quay về đăng nhập
        </button>
      )}
      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      )}
    </form>
  );
}
