import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import IpServiceSubPlatform from './pages/IpServiceSubPlatform.jsx';
import DeviceRegistrationAssignment from './pages/DeviceRegistrationAssignment.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import { ProtectedRoute, SuperRoute } from './components/ProtectedRoute.jsx';
import IpReport from './pages/admin/IpReport.jsx';
import DsrReport from './pages/admin/DsrReport.jsx';
import SeriesReport from './pages/admin/SeriesReport.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard.jsx';
import DeviceDetails from './pages/admin/DeviceDetails.jsx';
import DeviceList from './pages/admin/DeviceList.jsx';
import Departments from './pages/admin/Departments.jsx';
import AddDevices from './pages/AddDevices.jsx';

function AdminPage({ children }) {
  return (
    <ProtectedRoute>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

function SuperAdminPage({ children }) {
  return (
    <SuperRoute>
      <AdminLayout>{children}</AdminLayout>
    </SuperRoute>
  );
}

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin') || ['/devices', '/departments', '/device-register'].includes(location.pathname);
  const showTopNavbar = !isAdminRoute || location.pathname === '/admin/login';

  return (
    <div className="app-shell">
      {showTopNavbar ? <Navbar /> : null}
      <main className={showTopNavbar ? 'page-container' : 'admin-page-container'}>
        <Routes>
          <Route path="/" element={<DeviceRegistrationAssignment />} />
          <Route path="/ip-service" element={<DeviceRegistrationAssignment />} />
          <Route path="/ip-service/scan" element={<IpServiceSubPlatform />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/ip-report"
            element={
              <AdminPage>
                <IpReport />
              </AdminPage>
            }
          />
          <Route
            path="/admin/dsr-report"
            element={
              <AdminPage>
                <DsrReport />
              </AdminPage>
            }
          />
          <Route
            path="/admin/series-report"
            element={
              <AdminPage>
                <SeriesReport />
              </AdminPage>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminPage>
                <AnalyticsDashboard />
              </AdminPage>
            }
          />
          <Route
            path="/admin/device-details"
            element={
              <AdminPage>
                <DeviceDetails />
              </AdminPage>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminPage>
                <AdminUsers />
              </AdminPage>
            }
          />
          <Route
            path="/devices"
            element={
              <AdminPage>
                <DeviceList />
              </AdminPage>
            }
          />
          <Route
            path="/departments"
            element={
              <SuperAdminPage>
                <Departments />
              </SuperAdminPage>
            }
          />
          <Route
            path="/device-register"
            element={
              <AdminPage>
                <AddDevices />
              </AdminPage>
            }
          />
          <Route path="/admin/dashboard" element={<Navigate to="/admin/ip-report" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/ip-report" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
