import { lazy, Suspense } from 'react';
import { createHashRouter, Link } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { APP_ROUTE_PATHS, ROLE_ROUTE_PATHS, ROUTE_ROLE_GROUPS } from '../lib/rolePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Landing = lazy(() => import('../pages/Landing'));
const Login = lazy(() => import('../pages/Login'));
const RegisterByLink = lazy(() => import('../pages/RegisterByLink'));
const ForceChangePin = lazy(() => import('../pages/ForceChangePin'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('../pages/admin/UserManagement'));
const AuditLog = lazy(() => import('../pages/admin/AuditLog'));
const Logistics = lazy(() => import('../pages/admin/Logistics'));
const Documents = lazy(() => import('../pages/admin/Documents'));
const Announcements = lazy(() => import('../pages/admin/Announcements'));
const ShiftSchedule = lazy(() => import('../pages/admin/ShiftSchedule'));
const AttendanceReport = lazy(() => import('../pages/admin/AttendanceReport'));
const AdminApel = lazy(() => import('../pages/admin/Apel'));
const AdminKegiatan = lazy(() => import('../pages/admin/Kegiatan'));
const SatuanBrandingPage = lazy(() => import('../pages/admin/SatuanBrandingPage'));
const Settings = lazy(() => import('../pages/admin/Settings'));
const SatuanManagement = lazy(() => import('../pages/admin/SatuanManagement'));
const KomandanDashboard = lazy(() => import('../pages/komandan/KomandanDashboard'));
const TaskManagement = lazy(() => import('../pages/komandan/TaskManagement'));
const Personnel = lazy(() => import('../pages/komandan/Personnel'));
const Reports = lazy(() => import('../pages/komandan/Reports'));
const Evaluation = lazy(() => import('../pages/komandan/Evaluation'));
const KomandanAttendance = lazy(() => import('../pages/komandan/KomandanAttendance'));
const KomandanApel = lazy(() => import('../pages/komandan/Apel'));
const KomandanLaporanOps = lazy(() => import('../pages/komandan/LaporanOps'));
const KomandanSprint = lazy(() => import('../pages/komandan/Sprint'));
const LogisticsRequest = lazy(() => import('../pages/komandan/LogisticsRequest'));
const PrajuritDashboard = lazy(() => import('../pages/prajurit/PrajuritDashboard'));
const MyTasks = lazy(() => import('../pages/prajurit/MyTasks'));
const Attendance = lazy(() => import('../pages/prajurit/Attendance'));
const PrajuritApel = lazy(() => import('../pages/prajurit/Apel'));
const PrajuritKegiatan = lazy(() => import('../pages/prajurit/Kegiatan'));
const Messages = lazy(() => import('../pages/prajurit/Messages'));
const LeaveRequest = lazy(() => import('../pages/prajurit/LeaveRequest'));
const Profile = lazy(() => import('../pages/prajurit/Profile'));
const GatePassPage = lazy(() => import('../pages/prajurit/GatePassPage'));
const ScanPosJagaPage = lazy(() => import('../pages/prajurit/ScanPosJagaPage'));
const GatePassApprovalPage = lazy(() => import('../pages/komandan/GatePassApprovalPage'));
const GuardDashboard = lazy(() => import('../pages/guard/GuardDashboard'));
const GatePassMonitorPage = lazy(() => import('../pages/admin/GatePassMonitorPage'));
const PosJagaPage = lazy(() => import('../pages/admin/PosJagaPage'));
const StafDashboard = lazy(() => import('../pages/staf/StafDashboard'));
const StafMessages = lazy(() => import('../pages/staf/StafMessages'));
const StafLaporanOps = lazy(() => import('../pages/staf/LaporanOps'));
const StafSprint = lazy(() => import('../pages/staf/Sprint'));
const Analytics = lazy(() => import('../pages/admin/Analytics'));
const GuardDisciplineNotes = lazy(() => import('../pages/guard/DisciplineNotes'));
const StafLeaveReview = lazy(() => import('../pages/staf/LeaveReview'));
const ErrorPage = lazy(() => import('../pages/ErrorPage'));

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
    element: <ProtectedRoute allowedRoles={['admin', 'komandan', 'staf', 'guard', 'prajurit']} />,
    children: [
      { path: APP_ROUTE_PATHS.forceChangePin, element: wrap(<ForceChangePin />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.adminOnly} />,
    children: [
      { path: ROLE_ROUTE_PATHS.admin.dashboard, element: wrap(<AdminDashboard />) },
      { path: ROLE_ROUTE_PATHS.admin.satuan,    element: wrap(<SatuanManagement />) },
      { path: ROLE_ROUTE_PATHS.admin.users,     element: wrap(<UserManagement />) },
      { path: ROLE_ROUTE_PATHS.admin.posJaga,   element: wrap(<PosJagaPage />) },
      { path: ROLE_ROUTE_PATHS.admin.audit,     element: wrap(<AuditLog />) },
      { path: ROLE_ROUTE_PATHS.admin.settings,  element: wrap(<Settings />) },
      { path: ROLE_ROUTE_PATHS.admin.analytics, element: wrap(<Analytics />) },
      { path: ROLE_ROUTE_PATHS.admin.apel,      element: wrap(<AdminApel />) },
      { path: ROLE_ROUTE_PATHS.admin.kegiatan,  element: wrap(<AdminKegiatan />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.adminStaf} />,
    children: [
      { path: ROLE_ROUTE_PATHS.admin_satuan.branding,     element: wrap(<SatuanBrandingPage />) },
      { path: ROLE_ROUTE_PATHS.admin.logistics,       element: wrap(<Logistics />) },
      { path: ROLE_ROUTE_PATHS.admin.documents,       element: wrap(<Documents />) },
      { path: ROLE_ROUTE_PATHS.admin.announcements,   element: wrap(<Announcements />) },
      { path: ROLE_ROUTE_PATHS.admin.schedule,        element: wrap(<ShiftSchedule />) },
      { path: ROLE_ROUTE_PATHS.admin.attendance,      element: wrap(<AttendanceReport />) },
      { path: ROLE_ROUTE_PATHS.admin.gatePassMonitor, element: wrap(<GatePassMonitorPage />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.komandanShared} />,
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
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.guardShared} />,
    children: [
      { path: ROLE_ROUTE_PATHS.guard.gatePassScan, element: wrap(<GuardDashboard />) },
      { path: ROLE_ROUTE_PATHS.guard.discipline,   element: wrap(<GuardDisciplineNotes />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={ROUTE_ROLE_GROUPS.stafOnly} />,
    children: [
      { path: ROLE_ROUTE_PATHS.staf.dashboard,  element: wrap(<StafDashboard />) },
      { path: ROLE_ROUTE_PATHS.staf.messages,   element: wrap(<StafMessages />) },
      { path: ROLE_ROUTE_PATHS.staf.leaveReview,element: wrap(<StafLeaveReview />) },
      { path: ROLE_ROUTE_PATHS.staf.laporanOps, element: wrap(<StafLaporanOps />) },
      { path: ROLE_ROUTE_PATHS.staf.sprint,     element: wrap(<StafSprint />) },
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
