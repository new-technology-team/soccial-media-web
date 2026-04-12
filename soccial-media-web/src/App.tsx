import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Home, MessageCircle, Settings, Users } from "lucide-react";
import { api } from "./lib/api";
import { authStorage } from "./lib/auth";
import { connectSocket } from "./lib/socket";
import { HomeFeedShell } from "./components/HomeFeedShell";
import { AuthPage } from "./pages/AuthPage";
import { ProfilePanel } from "./components/profile/ProfilePanel";
import { NotificationsPanel } from "./components/dashboard/NotificationsPanel";
import { SettingsPanel } from "./components/dashboard/SettingsPanel";
import { FriendsPanel } from "./components/friends/FriendsPanel";
import { ChatPanel } from "./components/chat/ChatPanel";
import { ConversationList } from "./components/chat/ConversationList";
import { QuickCreateModal } from "./components/chat/QuickCreateModal";
import type {
  AppNotification,
  AuthUser,
  ChatMessage,
  Conversation,
  FriendItem,
  UserSettings,
} from "./types";
import type { Socket } from "socket.io-client";
import type { Mode } from "./pages/AuthPage";

type DashboardTab = "home" | "chat" | "friends" | "notifications" | "settings";

type Gender = "male" | "female" | "other";

const parseNotificationMeta = (metaJson?: string | null) => {
  if (!metaJson) return null;
  try {
    return JSON.parse(metaJson);
  } catch {
    return null;
  }
};

function App() {
  const socketRef = useRef<Socket | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isSendingMessageRef = useRef(false);

  // Auth state
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard state
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("home");

  // Auth form state
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newAuthPassword, setNewAuthPassword] = useState("");
  const [message, setMessage] = useState("");

  // Profile panel
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [messageType, setMessageType] = useState<
    "text" | "image" | "video" | "audio" | "file" | "sticker"
  >("text");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [typingState, setTypingState] = useState<Record<number, string>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConversationInfoOpen, setIsConversationInfoOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});

  // Friends state
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{
      id: number;
      full_name: string;
      email?: string;
      phone?: string;
      avatar_url?: string;
    }>
  >([]);

  // Notifications + settings
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Quick create modal
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [directUserIdInput, setDirectUserIdInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupMemberIdsInput, setGroupMemberIdsInput] = useState("");

  // ─── Computed ────────────────────────────────────────────────────────────────

  const selectedConversationPeer = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== "direct")
      return null;
    return (
      selectedConversation.members.find(
        (member) => member.userId !== profile?.id,
      ) || null
    );
  }, [selectedConversation, profile?.id]);

  const selectedConversationLastOutgoingMessage = useMemo(() => {
    if (
      !profile?.id ||
      !selectedConversation ||
      selectedConversation.type !== "direct"
    )
      return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === profile.id) return messages[i];
    }
    return null;
  }, [messages, profile?.id, selectedConversation]);

  const selectedConversationPeerLastReadAt = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== "direct")
      return null;
    return (
      selectedConversation.members.find((m) => m.userId !== profile?.id)
        ?.lastReadAt || null
    );
  }, [selectedConversation, profile?.id]);

  const isLastOutgoingSeen = useMemo(() => {
    if (
      !selectedConversationLastOutgoingMessage?.createdAt ||
      !selectedConversationPeerLastReadAt
    )
      return false;
    return (
      new Date(selectedConversationPeerLastReadAt).getTime() >=
      new Date(selectedConversationLastOutgoingMessage.createdAt).getTime()
    );
  }, [
    selectedConversationLastOutgoingMessage,
    selectedConversationPeerLastReadAt,
  ]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );
  const pendingFriendRequestsCount = useMemo(
    () =>
      friends.filter((f) => f.status === "pending" && !f.requestedByMe).length,
    [friends],
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const appendMessageIfNotExists = (msg: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );
  };

  const saveAuth = (payload: { accessToken: string; refreshToken: string }) => {
    authStorage.setTokens(payload.accessToken, payload.refreshToken);
  };

  const loadProfile = async () => {
    try {
      const me = await api.me();
      setProfile(me);
      setFullName(me.fullName || "");
      setAvatarUrl(me.avatarUrl || "");
      setDateOfBirth(me.dateOfBirth || "");
      setGender((me.gender as Gender) || "");
    } catch {
      authStorage.clear();
      setProfile(null);
    }
  };

  const loadConversations = async () => {
    const data = await api.listConversations();
    setConversations(data.conversations);
    setSelectedConversation((prev) => {
      if (prev) {
        const matched = data.conversations.find((c) => c.id === prev.id);
        if (matched) return matched;
      }
      return data.conversations[0] || null;
    });
    return data.conversations;
  };

  const loadFriends = async () => {
    const data = await api.listFriends();
    setFriends(data.friends);
  };

  const loadNotifications = async () => {
    const data = await api.listNotifications();
    setNotifications(data.notifications);
  };

  const loadSettings = async () => {
    const data = await api.getSettings();
    setSettings(data.settings);
  };

  const loadDashboardData = async () => {
    await Promise.all([
      loadConversations(),
      loadFriends(),
      loadNotifications(),
      loadSettings(),
    ]);
  };

  const loadMessages = async (conversationId: number) => {
    const data = await api.getConversationMessages(conversationId, 50);
    setMessages(data.messages);
    await api.markSeen(conversationId);
  };

  // ─── Auth handlers ───────────────────────────────────────────────────────────

  const handleLoginSuccess = async () => {
    await loadProfile();
    await loadDashboardData();
  };

  // ─── Profile handlers ────────────────────────────────────────────────────────

  const onUpdateProfile = async () => {
    try {
      setIsLoading(true);
      let uploadedAvatarUrl = avatarUrl;
      let avatarUploadWarning = "";
      if (avatarFile) {
        try {
          setIsUploadingAvatar(true);
          const uploadInfo = await api.getAvatarUploadUrl({
            fileName: avatarFile.name,
            contentType: avatarFile.type || "application/octet-stream",
          });
          try {
            await api.uploadAvatarToSignedUrl(
              uploadInfo.signedUploadUrl,
              avatarFile,
            );
            uploadedAvatarUrl = uploadInfo.mediaUrl || uploadInfo.signedReadUrl;
          } catch {
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () =>
                reject(new Error("Không thể đọc file ảnh"));
              reader.readAsDataURL(avatarFile);
            });
            const fallback = await api.uploadAvatarBase64({
              fileName: avatarFile.name,
              contentType: avatarFile.type || "application/octet-stream",
              base64Data,
            });
            uploadedAvatarUrl = fallback.mediaUrl || fallback.signedReadUrl;
            avatarUploadWarning = "Đã dùng chế độ upload dự phòng qua server.";
          }
        } catch (uploadError) {
          avatarUploadWarning =
            uploadError instanceof Error
              ? `Không thể tải ảnh: ${uploadError.message}`
              : "Không thể tải ảnh.";
        } finally {
          setIsUploadingAvatar(false);
        }
      }
      const data = await api.updateProfile({
        fullName: fullName || undefined,
        avatarUrl: uploadedAvatarUrl || undefined,
        dateOfBirth: dateOfBirth || null,
        gender: (gender || null) as Gender | null,
      });
      await loadProfile();
      setAvatarFile(null);
      setMessage(
        avatarUploadWarning
          ? `${data.message}. ${avatarUploadWarning}`
          : data.message,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Cập nhật hồ sơ thất bại",
      );
    } finally {
      setIsLoading(false);
      setIsUploadingAvatar(false);
    }
  };

  const onChangePassword = async () => {
    try {
      setIsLoading(true);
      const data = await api.changePassword({
        currentPassword,
        newPassword: newAuthPassword,
      });
      setCurrentPassword("");
      setNewAuthPassword("");
      authStorage.clear();
      setProfile(null);
      setMessage(`${data.message}. Vui lòng đăng nhập lại.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Đổi mật khẩu thất bại",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    authStorage.clear();
    socketRef.current?.disconnect();
    setProfile(null);
    setIsProfilePanelOpen(false);
    setMessage("Đã đăng xuất");
  };

  // ─── Chat handlers ───────────────────────────────────────────────────────────

  const onMessageInputChange = (value: string) => {
    setMessageInput(value);
    if (!selectedConversation) return;
    socketRef.current?.emit("typing", {
      conversationId: selectedConversation.id,
      isTyping: true,
    });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit("typing", {
        conversationId: selectedConversation.id,
        isTyping: false,
      });
    }, 1200);
  };

  const onSendMessage = async () => {
    if (isSendingMessageRef.current || !selectedConversation) return;
    try {
      isSendingMessageRef.current = true;
      setIsLoading(true);
      let mediaUrl: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      let fileSize: number | undefined;

      if (chatFile) {
        try {
          const upload = await api.getMessageUploadUrl(
            selectedConversation.id,
            {
              fileName: chatFile.name,
              contentType: chatFile.type || "application/octet-stream",
            },
          );
          await api.uploadMessageMediaToSignedUrl(
            upload.signedUploadUrl,
            chatFile,
          );
          mediaUrl = upload.mediaUrl;
        } catch {
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const raw = String(reader.result || "");
              resolve(
                raw.indexOf(",") >= 0 ? raw.slice(raw.indexOf(",") + 1) : raw,
              );
            };
            reader.onerror = () => reject(new Error("Không thể đọc file"));
            reader.readAsDataURL(chatFile);
          });
          const fallback = await api.uploadMessageBase64(
            selectedConversation.id,
            {
              fileName: chatFile.name,
              contentType: chatFile.type || "application/octet-stream",
              base64Data,
            },
          );
          mediaUrl = fallback.mediaUrl;
        }
        fileName = chatFile.name;
        mimeType = chatFile.type;
        fileSize = chatFile.size;
      }

      const result = await api.sendMessage(selectedConversation.id, {
        type: messageType,
        text: messageInput.trim() || undefined,
        mediaUrl,
        fileName,
        mimeType,
        fileSize,
        sticker: messageType === "sticker" ? messageInput.trim() : undefined,
      });
      appendMessageIfNotExists(result.message);
      setMessageInput("");
      setChatFile(null);
      setMessageType("text");
      await loadConversations();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể gửi tin nhắn",
      );
    } finally {
      isSendingMessageRef.current = false;
      setIsLoading(false);
    }
  };

  const onSearchMessages = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await api.searchMessages(searchKeyword.trim());
      setSearchResults(data.messages);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tìm kiếm tin nhắn",
      );
    }
  };

  const onToggleConversationNotify = async () => {
    if (!selectedConversation) return;
    try {
      await api.toggleConversationNotifications(
        selectedConversation.id,
        !selectedConversation.notificationsEnabled,
      );
      await loadConversations();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Lỗi cài đặt thông báo",
      );
    }
  };

  // ─── Friends handlers ────────────────────────────────────────────────────────

  const onSearchUsers = async () => {
    if (!userSearchKeyword.trim()) {
      setUserSearchResults([]);
      return;
    }
    try {
      const data = await api.searchUsers(userSearchKeyword.trim());
      setUserSearchResults(data.users);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tìm kiếm user",
      );
    }
  };

  const onRequestFriend = async (userId: number) => {
    try {
      await api.requestFriend(userId);
      await loadFriends();
      setMessage("Đã gửi lời mời kết bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi gửi lời mời");
    }
  };

  const onStartChatWithUser = async (userId: number) => {
    try {
      await api.createDirectConversation(userId);
      const updated = await loadConversations();
      const matched = updated.find(
        (c) =>
          c.type === "direct" && c.members.some((m) => m.userId === userId),
      );
      if (matched) setSelectedConversation(matched);
      setDashboardTab("chat");
      setMessage("Đã mở cuộc trò chuyện");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi mở chat");
    }
  };

  const onAcceptFriend = async (userId: number) => {
    try {
      await api.acceptFriend(userId);
      await loadFriends();
      await loadNotifications();
      setMessage("Đã chấp nhận kết bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi chấp nhận");
    }
  };

  const onRemoveFriend = async (userId: number) => {
    try {
      await api.removeFriend(userId);
      await loadFriends();
      setMessage("Đã xóa bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi xóa bạn");
    }
  };

  // ─── Notifications handlers ────────────────────────────────────────────────

  const onReadAllNotifications = async () => {
    try {
      await api.readAllNotifications();
      await loadNotifications();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Lỗi đánh dấu đã đọc",
      );
    }
  };

  const onReadNotification = async (id: number) => {
    try {
      await api.readNotification(id);
      await loadNotifications();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Lỗi cập nhật thông báo",
      );
    }
  };

  // ─── Settings handlers ───────────────────────────────────────────────────────

  const onUpdateSettings = async (next: Partial<UserSettings>) => {
    try {
      const data = await api.updateSettings(next);
      setSettings(data.settings);
      setMessage(data.message);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Lỗi cập nhật cài đặt",
      );
    }
  };

  // ─── Quick create ───────────────────────────────────────────────────────────

  const onCreateDirectConversation = async () => {
    const userId = Number(directUserIdInput);
    if (!userId) {
      setMessage("Nhập userId hợp lệ");
      return;
    }
    try {
      await api.createDirectConversation(userId);
      setDirectUserIdInput("");
      await loadConversations();
      setIsQuickCreateOpen(false);
      setMessage("Tạo chat 1-1 thành công");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi tạo chat");
    }
  };

  const onCreateGroupConversation = async () => {
    const memberIds = groupMemberIdsInput
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!groupNameInput.trim() || !memberIds.length) {
      setMessage("Nhập tên nhóm và ít nhất 1 userId");
      return;
    }
    try {
      await api.createGroupConversation({
        name: groupNameInput.trim(),
        memberIds,
      });
      setGroupNameInput("");
      setGroupMemberIdsInput("");
      await loadConversations();
      setIsQuickCreateOpen(false);
      setMessage("Tạo nhóm thành công");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lỗi tạo nhóm");
    }
  };

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authStorage.getAccessToken()) {
      loadProfile();
      loadDashboardData().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (dashboardTab === "home") return;
    if (dashboardTab === "chat") {
      loadConversations().catch(() => undefined);
      return;
    }
    if (dashboardTab === "friends") {
      loadFriends().catch(() => undefined);
      return;
    }
    if (dashboardTab === "notifications") {
      loadNotifications().catch(() => undefined);
      return;
    }
    if (dashboardTab === "settings") {
      loadSettings().catch(() => undefined);
    }
  }, [dashboardTab, profile?.id]);

  useEffect(() => {
    if (!profile) return;
    const token = authStorage.getAccessToken();
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on("message:new", (payload: ChatMessage) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === payload.conversationId);
        if (!exists) {
          loadConversations().catch(() => undefined);
          return prev;
        }
        return prev.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                unreadCount:
                  c.id === selectedConversation?.id ? 0 : c.unreadCount + 1,
                lastMessage: {
                  id: payload.id,
                  senderId: payload.senderId,
                  type: payload.type,
                  text: payload.text,
                  mediaUrl: payload.mediaUrl,
                  createdAt: payload.createdAt,
                },
              }
            : c,
        );
      });
      if (selectedConversation?.id === payload.conversationId)
        appendMessageIfNotExists(payload);
    });

    socket.on(
      "conversation:typing",
      (payload: {
        conversationId: number;
        userId: number;
        isTyping: boolean;
      }) => {
        if (payload.userId === profile.id) return;
        if (!payload.isTyping) {
          setTypingState((prev) => {
            const next = { ...prev };
            delete next[payload.conversationId];
            return next;
          });
          return;
        }
        setTypingState((prev) => ({
          ...prev,
          [payload.conversationId]: `User ${payload.userId} đang nhập...`,
        }));
      },
    );

    socket.on(
      "presence:online",
      (payload: { userId: number; isOnline: boolean }) => {
        setOnlineUsers((prev) => ({
          ...prev,
          [payload.userId]: payload.isOnline,
        }));
      },
    );

    socket.on(
      "conversation:seen",
      (payload: { conversationId: number; userId: number; seenAt: string }) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === payload.conversationId
              ? {
                  ...c,
                  members: c.members.map((m) =>
                    m.userId === payload.userId
                      ? { ...m, lastReadAt: payload.seenAt }
                      : m,
                  ),
                }
              : c,
          ),
        );
      },
    );

    socket.on("notification:new", () => {
      loadConversations().catch(() => undefined);
      loadNotifications().catch(() => undefined);
    });
    socket.on("friend:request", () => {
      loadNotifications().catch(() => undefined);
      loadFriends().catch(() => undefined);
    });
    socket.on("friend:accepted", () => {
      loadNotifications().catch(() => undefined);
      loadFriends().catch(() => undefined);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    socketRef.current?.emit("join-conversation", selectedConversation.id);
    loadMessages(selectedConversation.id).catch((error) =>
      setMessage(
        error instanceof Error ? error.message : "Không thể tải tin nhắn",
      ),
    );
  }, [selectedConversation?.id]);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsConversationInfoOpen(false);
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    const matched = conversations.find((c) => c.id === selectedConversation.id);
    if (matched && matched !== selectedConversation)
      setSelectedConversation(matched);
  }, [conversations, selectedConversation]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-orange-50 to-teal-50 p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-7xl items-start gap-4">
          {/* Left sidebar */}
          <section className="w-24 shrink-0 rounded-3xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Menu
            </h2>
            <div className="space-y-2">
              {(
                [
                  { key: "home", label: "Trang chủ", Icon: Home },
                  { key: "chat", label: "Chat", Icon: MessageCircle },
                  { key: "friends", label: "Bạn bè", Icon: Users },
                  { key: "notifications", label: "Thông báo", Icon: Bell },
                  { key: "settings", label: "Cài đặt", Icon: Settings },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  className={`w-full rounded-xl px-2 py-2 text-center ${dashboardTab === item.key ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700"}`}
                  type="button"
                  onClick={() => setDashboardTab(item.key)}
                  title={item.label}
                >
                  <div className="relative flex justify-center">
                    <item.Icon size={18} strokeWidth={2.25} />
                    {item.key === "notifications" &&
                      unreadNotificationsCount > 0 && (
                        <span className="absolute -right-2 -top-1 inline-flex min-w-4 justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                          {unreadNotificationsCount > 9
                            ? "9+"
                            : unreadNotificationsCount}
                        </span>
                      )}
                    {item.key === "friends" &&
                      pendingFriendRequestsCount > 0 && (
                        <span className="absolute -right-2 -top-1 inline-flex min-w-4 justify-center rounded-full bg-emerald-500 px-1 text-[10px] text-white">
                          {pendingFriendRequestsCount > 9
                            ? "9+"
                            : pendingFriendRequestsCount}
                        </span>
                      )}
                  </div>
                  <div className="mt-1 text-[10px] font-medium">
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Main content */}
          <section className="flex-1 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <header className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Soccial</h1>
                <p className="text-sm text-slate-600">Trang chủ</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="h-12 w-12 overflow-hidden rounded-full border-2 border-brand-200 transition hover:border-brand-400"
                  type="button"
                  onClick={() => setIsProfilePanelOpen((v) => !v)}
                  title="Mở hồ sơ cá nhân"
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-200 to-brand-300 text-sm font-bold text-brand-900">
                      {profile.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}
                </button>
                <button
                  className="h-10 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-900"
                  type="button"
                  onClick={onLogout}
                >
                  Đăng xuất
                </button>
              </div>
            </header>

            {dashboardTab === "home" && profile && (
              <HomeFeedShell profile={profile} />
            )}

            {dashboardTab === "chat" && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                <aside className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Hội thoại
                    </h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                      {conversations.length}
                    </span>
                  </div>
                  <ConversationList
                    conversations={conversations}
                    selectedConversation={selectedConversation}
                    profileId={profile.id}
                    onlineUsers={onlineUsers}
                    onSelect={setSelectedConversation}
                  />
                  <button
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    type="button"
                    onClick={() => setIsQuickCreateOpen(true)}
                  >
                    + Tạo hội thoại
                  </button>
                </aside>
                <ChatPanel
                  profile={profile}
                  selectedConversation={selectedConversation}
                  messages={messages}
                  messageInput={messageInput}
                  setMessageInput={onMessageInputChange}
                  messageType={messageType}
                  setMessageType={setMessageType}
                  chatFile={chatFile}
                  setChatFile={setChatFile}
                  searchKeyword={searchKeyword}
                  setSearchKeyword={setSearchKeyword}
                  searchResults={searchResults}
                  typingState={typingState}
                  isSearchOpen={isSearchOpen}
                  setIsSearchOpen={setIsSearchOpen}
                  isConversationInfoOpen={isConversationInfoOpen}
                  setIsConversationInfoOpen={setIsConversationInfoOpen}
                  isLastOutgoingSeen={isLastOutgoingSeen}
                  onSearchMessages={onSearchMessages}
                  onSendMessage={onSendMessage}
                  onToggleConversationNotify={onToggleConversationNotify}
                  onMarkSeen={() =>
                    selectedConversation &&
                    api.markSeen(selectedConversation.id).catch(() => undefined)
                  }
                  chatFileInputRef={chatFileInputRef}
                />
              </div>
            )}

            {dashboardTab === "friends" && (
              <FriendsPanel
                friends={friends}
                onlineUsers={onlineUsers}
                userSearchKeyword={userSearchKeyword}
                setUserSearchKeyword={setUserSearchKeyword}
                userSearchResults={userSearchResults}
                onSearchUsers={onSearchUsers}
                onRequestFriend={onRequestFriend}
                onStartChatWithUser={onStartChatWithUser}
                onAcceptFriend={onAcceptFriend}
                onRemoveFriend={onRemoveFriend}
              />
            )}

            {dashboardTab === "notifications" && settings && (
              <NotificationsPanel
                notifications={notifications}
                onReadNotification={onReadNotification}
                onReadAllNotifications={onReadAllNotifications}
              />
            )}

            {dashboardTab === "settings" && settings && (
              <SettingsPanel
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />
            )}
          </section>

          {/* Profile panel */}
          {isProfilePanelOpen && profile && (
            <ProfilePanel
              profile={profile}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              avatarFile={avatarFile}
              setAvatarFile={setAvatarFile}
              fullName={fullName}
              setFullName={setFullName}
              dateOfBirth={dateOfBirth}
              setDateOfBirth={setDateOfBirth}
              gender={gender}
              setGender={setGender}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newAuthPassword={newAuthPassword}
              setNewAuthPassword={setNewAuthPassword}
              isLoading={isLoading}
              isUploadingAvatar={isUploadingAvatar}
              onUpdateProfile={onUpdateProfile}
              onChangePassword={onChangePassword}
              onLogout={onLogout}
            />
          )}
        </div>

        <QuickCreateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          directUserIdInput={directUserIdInput}
          setDirectUserIdInput={setDirectUserIdInput}
          groupNameInput={groupNameInput}
          setGroupNameInput={setGroupNameInput}
          groupMemberIdsInput={groupMemberIdsInput}
          setGroupMemberIdsInput={setGroupMemberIdsInput}
          onCreateDirect={onCreateDirectConversation}
          onCreateGroup={onCreateGroupConversation}
        />

        {message && (
          <p className="mx-auto mt-4 w-full max-w-5xl rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <AuthPage onLoginSuccess={handleLoginSuccess} onSwitchToVerify={() => {}} />
  );
}

export default App;
