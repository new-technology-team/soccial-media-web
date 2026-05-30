import { lazy, Suspense } from 'react'
import { Outlet, Route } from 'react-router-dom'

import { Navigate } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'

import ExplorePage from '@/pages/(app)/explore/page'
import FeedPage from '@/pages/(app)/feed/page'
import FriendsPage from '@/pages/(app)/friends/page'
import MediaPage from '@/pages/(app)/media/page'
import MessagesPage from '@/pages/(app)/messages/page'
import NotificationsPage from '@/pages/(app)/notifications/page'
import PostDetailPage from '@/pages/(app)/posts/[id]/page'
import ProfilePage from '@/pages/(app)/profile/[id]/page'
import EditProfilePage from '@/pages/(app)/profile/edit/page'
import ReportPage from '@/pages/(app)/report/page'
import SettingsPage from '@/pages/(app)/settings/page'
import SystemAlertsPage from '@/pages/(app)/system-alerts/page'
import { renderAdminRoutes } from '@/routes/admin-routes'
import { useAuthStore } from '@/contexts/auth-store'

const AIChatPage                = lazy(() => import('@/pages/(app)/ai-chat/page'))
const ModeratorDashboardPage    = lazy(() => import('@/pages/(app)/moderator/dashboard/page'))
const ModeratorCommentsPage     = lazy(() => import('@/pages/(app)/moderator/comments/page'))
const ModeratorPostsPage        = lazy(() => import('@/pages/(app)/moderator/posts/page'))
const ModeratorMessagesPage     = lazy(() => import('@/pages/(app)/moderator/messages/page'))
const ModeratorHistoryPage      = lazy(() => import('@/pages/(app)/moderator/history/page'))
const ModeratorReportsPage      = lazy(() => import('@/pages/(app)/moderator/reports/page'))
const ModeratorReportDetailPage = lazy(() => import('@/pages/(app)/moderator/report-detail/[id]/page'))
const ModeratorUsersPage        = lazy(() => import('@/pages/(app)/moderator/users/page'))

const LazyFallback = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>
)

function AppLayoutRoute() {
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
      <Route path="/ai-chat" element={<Suspense fallback={<LazyFallback />}><AIChatPage /></Suspense>} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/system-alerts" element={<SystemAlertsPage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
      <Route path="/profile" element={<OwnProfileRoute />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
      <Route path="/profile/edit" element={<EditProfilePage />} />

      {renderAdminRoutes()}

      <Route path="/moderator/dashboard" element={<Suspense fallback={<LazyFallback />}><ModeratorDashboardPage /></Suspense>} />
      <Route path="/moderator/posts" element={<Suspense fallback={<LazyFallback />}><ModeratorPostsPage /></Suspense>} />
      <Route path="/moderator/users" element={<Suspense fallback={<LazyFallback />}><ModeratorUsersPage /></Suspense>} />
      <Route path="/moderator/comments" element={<Suspense fallback={<LazyFallback />}><ModeratorCommentsPage /></Suspense>} />
      <Route path="/moderator/messages" element={<Suspense fallback={<LazyFallback />}><ModeratorMessagesPage /></Suspense>} />
      <Route path="/moderator/history" element={<Suspense fallback={<LazyFallback />}><ModeratorHistoryPage /></Suspense>} />
      <Route path="/moderator/reports" element={<Suspense fallback={<LazyFallback />}><ModeratorReportsPage /></Suspense>} />
      <Route path="/moderator/report-detail/:id" element={<Suspense fallback={<LazyFallback />}><ModeratorReportDetailPage /></Suspense>} />
    </Route>
  )
}
