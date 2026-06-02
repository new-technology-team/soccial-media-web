import { Outlet, Route } from 'react-router-dom'

import { Navigate } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'
import AIChatPage from '@/pages/(app)/ai-chat/page'
import ExplorePage from '@/pages/(app)/explore/page'
import FeedPage from '@/pages/(app)/feed/page'
import FriendsPage from '@/pages/(app)/friends/page'
import MediaPage from '@/pages/(app)/media/page'
import MessagesPage from '@/pages/(app)/messages/page'
import ModeratorDashboardPage from '@/pages/(app)/moderator/dashboard/page'
import ModeratorCommentsPage from '@/pages/(app)/moderator/comments/page'
import ModeratorPostsPage from '@/pages/(app)/moderator/posts/page'
import ModeratorMessagesPage from '@/pages/(app)/moderator/messages/page'
import ModeratorHistoryPage from '@/pages/(app)/moderator/history/page'
import ModeratorReportsPage from '@/pages/(app)/moderator/reports/page'
import ModeratorReportDetailPage from '@/pages/(app)/moderator/report-detail/[id]/page'
import ModeratorUsersPage from '@/pages/(app)/moderator/users/page'
import NotificationsPage from '@/pages/(app)/notifications/page'
import PostDetailPage from '@/pages/(app)/posts/[id]/page'
import ProfilePage from '@/pages/(app)/profile/[id]/page'
import EditProfilePage from '@/pages/(app)/profile/edit/page'
import ReportPage from '@/pages/(app)/report/page'
import SettingsPage from '@/pages/(app)/settings/page'
import SystemAlertsPage from '@/pages/(app)/system-alerts/page'
import { renderAdminRoutes } from '@/routes/admin-routes'
import { useAuthStore } from '@/contexts/auth-store'

function AppLayoutRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  if (!accessToken) {
    const reason = sessionStorage.getItem('auth_cleared_reason')
    sessionStorage.removeItem('auth_cleared_reason')
    const loginPath = reason === 'session-expired' ? '/auth/login?reason=session-expired' : '/auth/login'
    return <Navigate to={loginPath} replace />
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function OwnProfileRoute() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={user ? `/profile/${user.id}` : '/auth/login?next=/profile'} replace />
}

export function renderAppRoutes() {
  return (
    <Route element={<AppLayoutRoute />}>
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/media" element={<MediaPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/friends" element={<FriendsPage />} />
      <Route path="/ai-chat" element={<AIChatPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/system-alerts" element={<SystemAlertsPage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
      <Route path="/profile" element={<OwnProfileRoute />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
      <Route path="/profile/edit" element={<EditProfilePage />} />

      {renderAdminRoutes()}

      <Route path="/moderator/dashboard" element={<ModeratorDashboardPage />} />
      <Route path="/moderator/posts" element={<ModeratorPostsPage />} />
      <Route path="/moderator/users" element={<ModeratorUsersPage />} />
      <Route path="/moderator/comments" element={<ModeratorCommentsPage />} />
      <Route path="/moderator/messages" element={<ModeratorMessagesPage />} />
      <Route path="/moderator/history" element={<ModeratorHistoryPage />} />
      <Route path="/moderator/reports" element={<ModeratorReportsPage />} />
      <Route path="/moderator/report-detail/:id" element={<ModeratorReportDetailPage />} />
    </Route>
  )
}

