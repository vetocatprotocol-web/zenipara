import { lazy, Suspense } from 'react';
import { createHashRouter, Link } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { APP_ROUTE_PATHS, ROLE_ROUTE_PATHS, ROUTE_ROLE_GROUPS } from '@/features/shared/lib/rolePermissions';
import LoadingSpinner from '@/features/shared/components/common/LoadingSpinner';

const Landing = lazy(() => import('@/features/shared/pages/Landing'));
const Login = lazy(() => import('@/features/auth/LoginPage'));
const RegisterByLink = lazy(() => import('@/features/auth/RegisterByLinkPage'));
const ForceChangePin = lazy(() => import('@/features/auth/ForceChangePinPage'));
const AdminDashboard = lazy(() => import('@/features/admin/pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('@/features/admin/pages/admin/UserManagement'));
const AuditLog = lazy(() => import('@/features/admin/pages/admin/AuditLog'));
const Logistics = lazy(() => import('@/features/admin/pages/admin/Logistics'));
const Documents = lazy(() => import('@/features/admin/pages/admin/Documents'));
const Announcements = lazy(() => import('@/features/admin/pages/admin/Announcements'));
const ShiftSchedule = lazy(() => import('@/features/admin/pages/admin/ShiftSchedule'));
const AttendanceReport = lazy(() => import('@/features/admin/pages/admin/AttendanceReport'));
const AdminApel = lazy(() => import('@/features/admin/pages/admin/Apel'));
const AdminKegiatan = lazy(() => import('@/features/admin/pages/admin/Kegiatan'));
const SatuanBrandingPage = lazy(() => import('@/features/admin/pages/admin/SatuanBrandingPage'));
const Settings = lazy(() => import('@/features/admin/pages/admin/Settings'));
const SatuanManagement = lazy(() => import('@/features/admin/pages/admin/SatuanManagement'));
const KomandanDashboard = lazy(() => import('@/features/komandan/pages/komandan/KomandanDashboard'));
const TaskManagement = lazy(() => import('@/features/komandan/pages/komandan/TaskManagement'));
const Personnel = lazy(() => import('@/features/komandan/pages/komandan/Personnel'));
const Reports = lazy(() => import('@/features/komandan/pages/komandan/Reports'));
const Evaluation = lazy(() => import('@/features/komandan/pages/komandan/Evaluation'));
const KomandanAttendance = lazy(() => import('@/features/komandan/pages/komandan/KomandanAttendance'));
const KomandanApel = lazy(() => import('@/features/komandan/pages/komandan/Apel'));
const KomandanLaporanOps = lazy(() => import('@/features/komandan/pages/komandan/LaporanOps'));
const KomandanSprint = lazy(() => import('@/features/komandan/pages/komandan/Sprint'));
const LogisticsRequest = lazy(() => import('@/features/komandan/pages/komandan/LogisticsRequest'));
const GatePassApprovalPage = lazy(() => import('@/features/komandan/pages/komandan/GatePassApprovalPage'));
const PrajuritDashboard = lazy(() => import('@/features/prajurit/pages/prajurit/PrajuritDashboard'));
const MyTasks = lazy(() => import('@/features/prajurit/pages/prajurit/MyTasks'));
const Attendance = lazy(() => import('@/features/prajurit/pages/prajurit/Attendance'));
const PrajuritApel = lazy(() => import('@/features/prajurit/pages/prajurit/Apel'));
const PrajuritKegiatan = lazy(() => import('@/features/prajurit/pages/prajurit/Kegiatan'));
const Messages = lazy(() => import('@/features/prajurit/pages/prajurit/Messages'));
const LeaveRequest = lazy(() => import('@/features/prajurit/pages/prajurit/LeaveRequest'));
const Profile = lazy(() => import('@/features/prajurit/pages/prajurit/Profile'));
const GatePassPage = lazy(() => import('@/features/prajurit/pages/prajurit/GatePassPage'));
const ScanPosJagaPage = lazy(() => import('@/features/prajurit/pages/prajurit/ScanPosJagaPage'));
const GuardDashboard = lazy(() => import('@/features/guard/pages/guard/GuardDashboard'));
const GatePassMonitorPage = lazy(() => import('@/features/admin/pages/admin/GatePassMonitorPage'));
const PosJagaPage = lazy(() => import('@/features/admin/pages/admin/PosJagaPage'));
const StaffDashboard = lazy(() => import('@/features/shared/pages/staf/StaffDashboard'));
const StaffMessages = lazy(() => import('@/features/shared/pages/staf/StaffMessages'));
const StaffLaporanOps = lazy(() => import('@/features/shared/pages/staf/LaporanOps'));
const StaffSprint = lazy(() => import('@/features/shared/pages/staf/Sprint'));
const Analytics = lazy(() => import('@/features/admin/pages/admin/Analytics'));
const GuardDisciplineNotes = lazy(() => import('@/features/guard/pages/guard/DisciplineNotes'));
const StaffLeaveReview = lazy(() => import('@/features/shared/pages/staf/LeaveReview'));
const ErrorPage = lazy(() => import('@/features/shared/pages/ErrorPage'));

const wrap = (element: React.ReactNode) => (
  <Suspense fallback={<LoadingSpinner fullScreen />}>{element}</Suspense>
);

export const router = createHashRouter([
  {
    path: APP_ROUTE_PATHS.root,
    element: wrap(<Landing />),
  },
  {
    path: APP_ROUTE_PATHS.login,
    element: wrap(<Login />),
  },
  {
    path: APP_ROUTE_PATHS.register,
    element: wrap(<RegisterByLink />),
  },
  {
    element: <ProtectedRoute allowedRoles={['admin_satuan', 'komandan', 'staff_satuan', 'guard', 'prajurit']} />,
    children: [
      { path: APP_ROUTE_PATHS.forceChangePin, element: wrap(<ForceChangePin />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.adminOnly} />,
    children: [
      { path: ROLE_ROUTE_PATHS.admin_satuan.dashboard, element: wrap(<AdminDashboard />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.satuan,    element: wrap(<SatuanManagement />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.users,     element: wrap(<UserManagement />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.posJaga,   element: wrap(<PosJagaPage />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.audit,     element: wrap(<AuditLog />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.settings,  element: wrap(<Settings />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.analytics, element: wrap(<Analytics />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.apel,      element: wrap(<AdminApel />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.kegiatan,  element: wrap(<AdminKegiatan />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.adminOnlyf} />,
    children: [
      { path: ROLE_ROUTE_PATHS.admin_satuan.branding,     element: wrap(<SatuanBrandingPage />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.logistics,       element: wrap(<Logistics />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.documents,       element: wrap(<Documents />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.announcements,   element: wrap(<Announcements />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.schedule,        element: wrap(<ShiftSchedule />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.attendance,      element: wrap(<AttendanceReport />) },
      { path: ROLE_ROUTE_PATHS.admin_satuan.gatePassMonitor, element: wrap(<GatePassMonitorPage />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.adminKomandan} />,
    children: [
      { path: ROLE_ROUTE_PATHS.komandan.dashboard,       element: wrap(<KomandanDashboard />) },
      { path: ROLE_ROUTE_PATHS.komandan.tasks,           element: wrap(<TaskManagement />) },
      { path: ROLE_ROUTE_PATHS.komandan.personnel,       element: wrap(<Personnel />) },
      { path: ROLE_ROUTE_PATHS.komandan.reports,         element: wrap(<Reports />) },
      { path: ROLE_ROUTE_PATHS.komandan.evaluation,      element: wrap(<Evaluation />) },
      { path: ROLE_ROUTE_PATHS.komandan.attendance,      element: wrap(<KomandanAttendance />) },
      { path: ROLE_ROUTE_PATHS.komandan.apel,            element: wrap(<KomandanApel />) },
      { path: ROLE_ROUTE_PATHS.komandan.kegiatan,        element: wrap(<AdminKegiatan />) },
      { path: ROLE_ROUTE_PATHS.komandan.laporanOps,      element: wrap(<KomandanLaporanOps />) },
      { path: ROLE_ROUTE_PATHS.komandan.sprint,          element: wrap(<KomandanSprint />) },
      { path: ROLE_ROUTE_PATHS.komandan.logisticsRequest,element: wrap(<LogisticsRequest />) },
      { path: ROLE_ROUTE_PATHS.komandan.gatePassApproval,element: wrap(<GatePassApprovalPage />) },
      { path: ROLE_ROUTE_PATHS.komandan.gatePassMonitor, element: wrap(<GatePassMonitorPage />) },
      { path: ROLE_ROUTE_PATHS.komandan.messages,        element: wrap(<Messages />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.prajuritShared} />,
    children: [
      { path: ROLE_ROUTE_PATHS.prajurit.dashboard,  element: wrap(<PrajuritDashboard />) },
      { path: ROLE_ROUTE_PATHS.prajurit.tasks,      element: wrap(<MyTasks />) },
      { path: ROLE_ROUTE_PATHS.prajurit.attendance, element: wrap(<Attendance />) },
      { path: ROLE_ROUTE_PATHS.prajurit.apel,      element: wrap(<PrajuritApel />) },
      { path: ROLE_ROUTE_PATHS.prajurit.kegiatan,  element: wrap(<PrajuritKegiatan />) },
      { path: ROLE_ROUTE_PATHS.prajurit.messages,  element: wrap(<Messages />) },
      { path: ROLE_ROUTE_PATHS.prajurit.leave,      element: wrap(<LeaveRequest />) },
      { path: ROLE_ROUTE_PATHS.prajurit.profile,    element: wrap(<Profile />) },
      { path: ROLE_ROUTE_PATHS.prajurit.gatePass,   element: wrap(<GatePassPage />) },
      { path: ROLE_ROUTE_PATHS.prajurit.scanPos,    element: wrap(<ScanPosJagaPage />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.allRoles} />,
    children: [
      { path: ROLE_ROUTE_PATHS.guard.gatePassScan, element: wrap(<GuardDashboard />) },
      { path: ROLE_ROUTE_PATHS.guard.discipline,   element: wrap(<GuardDisciplineNotes />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.staffOnly} />,
    children: [
      { path: ROLE_ROUTE_PATHS.staff_satuan.dashboard,  element: wrap(<StaffDashboard />) },
      { path: ROLE_ROUTE_PATHS.staff_satuan.messages,   element: wrap(<StaffMessages />) },
      { path: ROLE_ROUTE_PATHS.staff_satuan.leaveReview,element: wrap(<StaffLeaveReview />) },
      { path: ROLE_ROUTE_PATHS.staff_satuan.laporanOps, element: wrap(<StaffLaporanOps />) },
      { path: ROLE_ROUTE_PATHS.staff_satuan.sprint,     element: wrap(<StaffSprint />) },
    ],
  },
  {
    path: APP_ROUTE_PATHS.error,
    element: wrap(<ErrorPage />),
  },
  {
    path: '*',
    element: (
      <div className="flex items-center justify-center min-h-screen bg-military-dark text-text-primary">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
          <p className="text-xl text-text-muted mb-6">Halaman tidak ditemukan</p>
          <Link to={APP_ROUTE_PATHS.login} className="btn-primary px-6 py-2 rounded-lg">
            Kembali ke Login
          </Link>
        </div>
      </div>
    ),
  },
]);
