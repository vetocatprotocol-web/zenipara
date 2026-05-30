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
  import { lazy, Suspense } from 'react';
  import { createHashRouter } from 'react-router-dom';
  import ProtectedRoute from './ProtectedRoute';
  import {
        APP_ROUTE_PATHS,
          ROLE_ROUTE_PATHS,
            ROUTE_ROLE_GROUPS,
  } from '@/features/shared/lib/rolePermissions';
  import LoadingSpinner from '@/features/shared/components/common/LoadingSpinner';

  // ── Shared ─────────────────────────────────────────────────
  const Landing        = lazy(() => import('@/features/shared/pages/Landing'));
  const ErrorPage      = lazy(() => import('@/features/shared/pages/ErrorPage'));

  // ── Auth ───────────────────────────────────────────────────
  const Login          = lazy(() => import('@/features/auth/LoginPage'));
  const RegisterByLink = lazy(() => import('@/features/auth/RegisterByLinkPage'));
  const ForceChangePin = lazy(() => import('@/features/auth/ForceChangePinPage'));

  // ── Super Admin ────────────────────────────────────────────
  const SuperAdminDashboard = lazy(() => import('@/features/super-admin/pages/SuperAdminDashboard'));
  const GlobalSatuanMgmt    = lazy(() => import('@/features/super-admin/pages/SatuanManagement'));
  const GlobalSettings      = lazy(() => import('@/features/super-admin/pages/GlobalSettings'));
  const GlobalAuditLog      = lazy(() => import('@/features/super-admin/pages/GlobalAuditLog'));

  // ── Admin Satuan ───────────────────────────────────────────
  const AdminDashboard   = lazy(() => import('@/features/admin/pages/AdminDashboard'));
  const UserManagement   = lazy(() => import('@/features/admin/pages/UserManagement'));
  const SatuanBranding   = lazy(() => import('@/features/admin/pages/SatuanBrandingPage'));
  const GatePassMonitor  = lazy(() => import('@/features/admin/pages/GatePassMonitorPage'));
  const Logistics        = lazy(() => import('@/features/admin/pages/Logistics'));
  const Announcements    = lazy(() => import('@/features/admin/pages/Announcements'));
  const AttendanceReport = lazy(() => import('@/features/admin/pages/AttendanceReport'));
  const Analytics        = lazy(() => import('@/features/admin/pages/Analytics'));
  const AdminApel        = lazy(() => import('@/features/admin/pages/Apel'));
  const AdminKegiatan    = lazy(() => import('@/features/admin/pages/Kegiatan'));
  const ShiftSchedule    = lazy(() => import('@/features/admin/pages/ShiftSchedule'));
  const PosJaga          = lazy(() => import('@/features/admin/pages/PosJagaPage'));
  const Documents        = lazy(() => import('@/features/admin/pages/Documents'));
  const AdminSettings    = lazy(() => import('@/features/admin/pages/Settings'));

  // ── Komandan ───────────────────────────────────────────────
  const KomandanDashboard  = lazy(() => import('@/features/komandan/pages/KomandanDashboard'));
  const TaskManagement     = lazy(() => import('@/features/komandan/pages/TaskManagement'));
  const Personnel          = lazy(() => import('@/features/komandan/pages/Personnel'));
  const GatePassApproval   = lazy(() => import('@/features/komandan/pages/GatePassApprovalPage'));
  const KomandanAttendance = lazy(() => import('@/features/komandan/pages/KomandanAttendance'));
  const LaporanOpsKomandan = lazy(() => import('@/features/komandan/pages/LaporanOps'));
  const KomandanSprint     = lazy(() => import('@/features/komandan/pages/Sprint'));
  const Reports            = lazy(() => import('@/features/komandan/pages/Reports'));
  const Evaluation         = lazy(() => import('@/features/komandan/pages/Evaluation'));
  const KomandanApel       = lazy(() => import('@/features/komandan/pages/Apel'));
  const LogisticsRequest   = lazy(() => import('@/features/komandan/pages/LogisticsRequest'));

  // ── Staff Satuan ───────────────────────────────────────────
  const StaffDashboard   = lazy(() => import('@/features/staff/pages/StaffDashboard'));
  const StaffMessages    = lazy(() => import('@/features/staff/pages/StaffMessages'));
  const StaffLeaveReview = lazy(() => import('@/features/staff/pages/LeaveReview'));
  const StaffLaporanOps  = lazy(() => import('@/features/staff/pages/LaporanOps'));
  const StaffSprint      = lazy(() => import('@/features/staff/pages/Sprint'));

  // ── Prajurit ───────────────────────────────────────────────
  const PrajuritDashboard = lazy(() => import('@/features/prajurit/pages/PrajuritDashboard'));
  const GatePassPage      = lazy(() => import('@/features/prajurit/pages/GatePassPage'));
  const Attendance        = lazy(() => import('@/features/prajurit/pages/Attendance'));
  const MyTasks           = lazy(() => import('@/features/prajurit/pages/MyTasks'));
  const LeaveRequest      = lazy(() => import('@/features/prajurit/pages/LeaveRequest'));
  const Messages          = lazy(() => import('@/features/prajurit/pages/Messages'));
  const Profile           = lazy(() => import('@/features/prajurit/pages/Profile'));
  const PrajuritApel      = lazy(() => import('@/features/prajurit/pages/Apel'));
  const PrajuritKegiatan  = lazy(() => import('@/features/prajurit/pages/Kegiatan'));
  const ScanPosJaga       = lazy(() => import('@/features/prajurit/pages/ScanPosJagaPage'));

  // ── Helper ─────────────────────────────────────────────────
  const wrap = (el: React.ReactNode) => (
        <Suspense fallback={<LoadingSpinner fullScreen />}>{el}</Suspense>
  );

  const R = ROLE_ROUTE_PATHS;
  const G = ROUTE_ROLE_GROUPS;

  // ── Router ─────────────────────────────────────────────────
  export const router = createHashRouter([
        // Public
          { path: APP_ROUTE_PATHS.root,     element: wrap(<Landing />) },
            { path: APP_ROUTE_PATHS.login,    element: wrap(<Login />) },
              { path: APP_ROUTE_PATHS.register, element: wrap(<RegisterByLink />) },
                { path: APP_ROUTE_PATHS.error,    element: wrap(<ErrorPage />) },

                  // Force change PIN — semua role
                    {
                          element: <ProtectedRoute allowedRoles={G.allRoles} />,
                              children: [
                                        { path: APP_ROUTE_PATHS.forceChangePin, element: wrap(<ForceChangePin />) },
                              ],
                    },

                      // ── Super Admin ──────────────────────────────────────────
                        {
                              element: <ProtectedRoute allowedRoles={G.superAdminOnly} />,
                                  children: [
                                            { path: R.super_admin.dashboard, element: wrap(<SuperAdminDashboard />) },
                                                  { path: R.super_admin.satuans,   element: wrap(<GlobalSatuanMgmt />) },
                                                        { path: R.super_admin.settings,  element: wrap(<GlobalSettings />) },
                                                              { path: R.super_admin.audit,     element: wrap(<GlobalAuditLog />) },
                                  ],
                        },

                          // ── Admin Satuan ─────────────────────────────────────────
                            {
                                  element: <ProtectedRoute allowedRoles={G.adminOnly} />,
                                      children: [
                                                { path: R.admin_satuan.dashboard,       element: wrap(<AdminDashboard />) },
                                                      { path: R.admin_satuan.users,           element: wrap(<UserManagement />) },
                                                            { path: R.admin_satuan.branding,        element: wrap(<SatuanBranding />) },
                                                                  { path: R.admin_satuan.gatePassMonitor, element: wrap(<GatePassMonitor />) },
                                                                        { path: R.admin_satuan.logistics,       element: wrap(<Logistics />) },
                                                                              { path: R.admin_satuan.announcements,   element: wrap(<Announcements />) },
                                                                                    { path: R.admin_satuan.attendance,      element: wrap(<AttendanceReport />) },
                                                                                          { path: R.admin_satuan.analytics,       element: wrap(<Analytics />) },
                                                                                                { path: R.admin_satuan.apel,            element: wrap(<AdminApel />) },
                                                                                                      { path: R.admin_satuan.kegiatan,        element: wrap(<AdminKegiatan />) },
                                                                                                            { path: R.admin_satuan.schedule,        element: wrap(<ShiftSchedule />) },
                                                                                                                  { path: R.admin_satuan.posJaga,         element: wrap(<PosJaga />) },
                                                                                                                        { path: R.admin_satuan.documents,       element: wrap(<Documents />) },
                                                                                                                              { path: R.admin_satuan.settings,        element: wrap(<AdminSettings />) },
                                      ],
                            },

                              // ── Komandan ─────────────────────────────────────────────
                                {
                                      element: <ProtectedRoute allowedRoles={['komandan']} />,
                                          children: [
                                                    { path: R.komandan.dashboard,    element: wrap(<KomandanDashboard />) },
                                                          { path: R.komandan.tasks,        element: wrap(<TaskManagement />) },
                                                                { path: R.komandan.personnel,    element: wrap(<Personnel />) },
                                                                      { path: R.komandan.gatePass,     element: wrap(<GatePassApproval />) },
                                                                            { path: R.komandan.attendance,   element: wrap(<KomandanAttendance />) },
                                                                                  { path: R.komandan.laporanOps,   element: wrap(<LaporanOpsKomandan />) },
                                                                                        { path: R.komandan.sprint,       element: wrap(<KomandanSprint />) },
                                                                                              { path: R.komandan.reports,      element: wrap(<Reports />) },
                                                                                                    { path: R.komandan.evaluation,   element: wrap(<Evaluation />) },
                                                                                                          { path: R.komandan.apel,         element: wrap(<KomandanApel />) },
                                                                                                                { path: R.komandan.logistics,    element: wrap(<LogisticsRequest />) },
                                          ],
                                },

                                  // ── Staff Satuan ─────────────────────────────────────────
                                    {
                                          element: <ProtectedRoute allowedRoles={G.staffOnly} />,
                                              children: [
                                                        { path: R.staff_satuan.dashboard,   element: wrap(<StaffDashboard />) },
                                                              { path: R.staff_satuan.messages,    element: wrap(<StaffMessages />) },
                                                                    { path: R.staff_satuan.leaveReview, element: wrap(<StaffLeaveReview />) },
                                                                          { path: R.staff_satuan.laporanOps,  element: wrap(<StaffLaporanOps />) },
                                                                                { path: R.staff_satuan.sprint,      element: wrap(<StaffSprint />) },
                                              ],
                                    },

                                      // ── Prajurit ─────────────────────────────────────────────
                                        {
                                              element: <ProtectedRoute allowedRoles={['prajurit']} />,
                                                  children: [
                                                            { path: R.prajurit.dashboard,  element: wrap(<PrajuritDashboard />) },
                                                                  { path: R.prajurit.gatePass,   element: wrap(<GatePassPage />) },
                                                                        { path: R.prajurit.attendance, element: wrap(<Attendance />) },
                                                                              { path: R.prajurit.tasks,      element: wrap(<MyTasks />) },
                                                                                    { path: R.prajurit.leave,      element: wrap(<LeaveRequest />) },
                                                                                          { path: R.prajurit.messages,   element: wrap(<Messages />) },
                                                                                                { path: R.prajurit.profile,    element: wrap(<Profile />) },
                                                                                                      { path: R.prajurit.apel,       element: wrap(<PrajuritApel />) },
                                                                                                            { path: R.prajurit.kegiatan,   element: wrap(<PrajuritKegiatan />) },
                                                                                                                  { path: R.prajurit.scanPos,    element: wrap(<ScanPosJaga />) },
                                                  ],
                                        },

                                          // Catch-all
                                            { path: '*', element: wrap(<ErrorPage />) },
  ]);
