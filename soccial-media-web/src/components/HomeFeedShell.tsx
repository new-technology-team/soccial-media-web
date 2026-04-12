import { useState } from "react";
import { Heart, MessageCircle, Repeat2, Search, Share2 } from "lucide-react";
import { fetchBackendHealth } from "../lib/api";
import type { AuthUser } from "../types";

type FeedTab = "forYou" | "following";

type Props = {
  profile: AuthUser;
};

const MOCK_POSTS = [
  {
    id: "1",
    name: "Nhóm CNM",
    handle: "@cnm_demo",
    time: "2 giờ",
    text: "Bài mẫu trên dòng thời gian. Bước sau: API Post (MongoDB) + user liên kết MariaDB theo sơ đồ lớp.",
    likes: 12,
    replies: 3,
    reposts: 1
  },
  {
    id: "2",
    name: "Tài khoản demo",
    handle: "@guest_view",
    time: "Hôm qua",
    text: "Khách vãng lai sau này sẽ xem được feed công khai; hiện tại chỉ là layout UI để team review.",
    likes: 48,
    replies: 6,
    reposts: 4
  }
];

function buildUserHandle(user: AuthUser): string {
  const email = user.email?.trim();
  if (email && email.includes("@")) {
    return `@${email.split("@")[0]}`;
  }
  const phone = user.phone?.replace(/\s/g, "");
  if (phone && phone.length >= 4) {
    return `@${phone.slice(-4)}`;
  }
  return `@user${user.id}`;
}

export function HomeFeedShell({ profile }: Props) {
  const [feedTab, setFeedTab] = useState<FeedTab>("forYou");
  const [draft, setDraft] = useState("");
  const [healthHint, setHealthHint] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const displayName = profile.fullName?.trim() || "Bạn";
  const handle = buildUserHandle(profile);
  const initial = displayName.charAt(0).toUpperCase();

  const onPingBackend = async () => {
    setHealthLoading(true);
    setHealthHint(null);
    try {
      const h = await fetchBackendHealth();
      setHealthHint(`${h.status} · ${h.service || "backend"}${h.now ? ` · ${h.now}` : ""}`);
    } catch (e) {
      setHealthHint(e instanceof Error ? e.message : "Lỗi kiểm tra");
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
          <div className="flex">
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-semibold transition ${feedTab === "forYou" ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}
              onClick={() => setFeedTab("forYou")}
            >
              Dành cho bạn
            </button>
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-semibold transition ${feedTab === "following" ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}
              onClick={() => setFeedTab("following")}
            >
              Đang theo dõi
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 p-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-200 to-teal-200 text-sm font-bold text-slate-800">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{displayName}</span>{" "}
                <span className="text-slate-400">{handle}</span>
              </p>
              <label className="sr-only" htmlFor="home-compose">
                Soạn bài viết
              </label>
              <textarea
                id="home-compose"
                rows={2}
                className="w-full resize-none border-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                placeholder="Chuyện gì đang xảy ra?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!draft.trim()}
                  title="Chưa nối API — chỉ là UI"
                >
                  Đăng
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Nút Đăng sẽ gọi API khi backend Post sẵn sàng.</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {feedTab === "following" ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có bài từ người bạn theo dõi. Tab này sẽ dùng API sau.
            </div>
          ) : (
            MOCK_POSTS.map((post) => (
              <article key={post.id} className="px-4 py-3 transition hover:bg-slate-50/80">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                    {post.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-bold text-slate-900">{post.name}</span>
                      <span className="text-slate-500">{post.handle}</span>
                      <span className="text-slate-400">· {post.time}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{post.text}</p>
                    <div className="mt-3 flex max-w-md items-center justify-between text-slate-500">
                      <button type="button" className="flex items-center gap-1.5 rounded-full p-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700" title="Bình luận">
                        <MessageCircle size={18} strokeWidth={2} />
                        <span>{post.replies}</span>
                      </button>
                      <button type="button" className="flex items-center gap-1.5 rounded-full p-1.5 text-xs hover:bg-teal-50 hover:text-teal-700" title="Chia sẻ lại">
                        <Repeat2 size={18} strokeWidth={2} />
                        <span>{post.reposts}</span>
                      </button>
                      <button type="button" className="flex items-center gap-1.5 rounded-full p-1.5 text-xs hover:bg-rose-50 hover:text-rose-600" title="Thích">
                        <Heart size={18} strokeWidth={2} />
                        <span>{post.likes}</span>
                      </button>
                      <button type="button" className="rounded-full p-1.5 hover:bg-slate-100" title="Chia sẻ">
                        <Share2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Tìm kiếm (sắp có)"
            readOnly
            title="Tìm kiếm — API sau"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Xu hướng</h3>
          <p className="mt-2 text-sm text-slate-500">Nội dung trending sẽ lấy từ backend sau.</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700"># đồánCNM</li>
            <li className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700"># realtime</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-teal-50 p-4 text-sm text-slate-700">
          <strong className="text-indigo-900">Gợi ý tiếp theo:</strong> nối API danh sách Post (đọc công khai cho khách), rồi đăng bài / bình luận cho user đã đăng nhập.
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <p className="mb-2 font-semibold text-slate-800">Kết nối API</p>
          <button
            type="button"
            className="w-full rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-50"
            disabled={healthLoading}
            onClick={onPingBackend}
          >
            {healthLoading ? "Đang gọi /health..." : "Kiểm tra backend (/health)"}
          </button>
          {healthHint && <p className="mt-2 break-all text-xs text-slate-600">{healthHint}</p>}
        </div>
      </aside>
    </div>
  );
}
