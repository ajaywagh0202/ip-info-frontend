import { NavLink } from 'react-router-dom';
import { BarChart3, ClipboardList, Hash, Monitor, UserRound } from 'lucide-react';
import { getAdminProfile, isSuperUser } from '../utils/adminAuth.js';

const menuItems = [
  { to: '/admin/analytics', label: 'Analytics Dashboard', icon: BarChart3 },
  { to: '/admin/device-details', label: 'Device Details', icon: Monitor },
  { to: '/admin/ip-report', label: 'IP Report', icon: Monitor },
  { to: '/admin/dsr-report', label: 'DSR Report', icon: ClipboardList },
  { to: '/admin/series-report', label: 'Series Report', icon: Hash },
  { to: '/admin/users', label: 'Add Admin User', icon: UserRound },
];

export default function Sidebar() {
  const profile = getAdminProfile();

  return (
    <aside className="admin-sidebar">
      <nav className="admin-menu" aria-label="Admin reports">
        {menuItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `admin-menu-item${isActive ? ' active' : ''}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-badge">
        {isSuperUser() ? 'Super User' : profile.dept_name || 'Department User'}
      </div>
    </aside>
  );
}
