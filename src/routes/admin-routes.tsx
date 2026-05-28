import { Navigate, Outlet, Route } from 'react-router-dom'

import AdminLayout from '@/components/layouts/AdminLayout'
import AdminDashboardPage from '@/pages/(app)/admin/dashboard/page'
import AdminAuditLogsPage from '@/pages/(app)/admin/audit-logs/page'
import AdminModeratorsPage from '@/pages/(app)/admin/moderators/page'
import AdminPostsPage from '@/pages/(app)/admin/posts/page'
import AdminReportsPage from '@/pages/(app)/admin/reports/page'
import AdminSettingsPage from '@/pages/(app)/admin/settings/page'
import AdminStatisticsPage from '@/pages/(app)/admin/statistics/page'
import AdminUsersPage from '@/pages/(app)/admin/users/page'

function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

export function renderAdminRoutes() {
  return (
    <Route path="/admin" element={<AdminLayoutRoute />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboardPage />} />
      <Route path="posts" element={<AdminPostsPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="moderators" element={<AdminModeratorsPage />} />
      <Route path="reports" element={<AdminReportsPage />} />
      <Route path="statistics" element={<AdminStatisticsPage />} />
      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="settings" element={<AdminSettingsPage />} />
    </Route>
  )
}

