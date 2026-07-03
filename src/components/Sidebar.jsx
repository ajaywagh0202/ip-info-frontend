import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Building2, ChevronDown, ClipboardList, FileText, FolderKanban, Hash, Monitor, Server, Settings2, UserRound } from 'lucide-react';
import { getAdminProfile, isSuperUser } from '../utils/adminAuth.js';

const topMenuItems = [
  { to: '/admin/analytics', label: 'Analytics Dashboard', icon: BarChart3 },
  { to: '/device-register', label: 'Register Device', icon: ClipboardList }
];

const menuGroups = [
  {
    key: 'reports',
    label: 'Reports',
    icon: FolderKanban,
    items: [
      { to: '/admin/device-details', label: 'Device Details', icon: Monitor },
      { to: '/admin/ip-report', label: 'IP Report', icon: FileText },
      { to: '/admin/dsr-report', label: 'DSR Report', icon: ClipboardList },
      { to: '/admin/series-report', label: 'Series Report', icon: Hash },
    ],
  },
  {
    key: 'masters',
    label: 'Masters',
    icon: Settings2,
    items: [
      { to: '/admin/users', label: 'Add Admin User', icon: UserRound },
      { to: '/devices', label: 'Device List', icon: Server },
      { to: '/departments', label: 'Departments', icon: Building2, superOnly: true },
    ],
  },
];

function isCurrentPath(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function Sidebar() {
  const location = useLocation();
  const profile = getAdminProfile();
  const canViewSuperOnly = profile.user_type === 0;
  const visibleTopMenuItems = topMenuItems.filter((item) => !item.superOnly || canViewSuperOnly);
  const visibleMenuGroups = useMemo(() => (
    menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.superOnly || canViewSuperOnly),
      }))
      .filter((group) => group.items.length)
  ), [canViewSuperOnly]);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    const activeGroup = visibleMenuGroups.find((group) => (
      group.items.some((item) => isCurrentPath(location.pathname, item.to))
    ));
    if (!activeGroup) return;

    setOpenGroups((current) => (
      current[activeGroup.key] ? current : { ...current, [activeGroup.key]: true }
    ));
  }, [location.pathname, visibleMenuGroups]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  return (
    <aside className="admin-sidebar">
      <nav className="admin-menu" aria-label="Admin navigation">
        {visibleTopMenuItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `admin-menu-item${isActive ? ' active' : ''}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
        {visibleMenuGroups.map(({ key, label, icon: GroupIcon, items }) => {
          const isOpen = Boolean(openGroups[key]);
          const hasActiveItem = items.some((item) => isCurrentPath(location.pathname, item.to));

          return (
          <div className={`admin-menu-group${isOpen ? ' is-open' : ''}${hasActiveItem ? ' has-active' : ''}`} key={key}>
            <button
              className="admin-menu-group-title"
              type="button"
              aria-expanded={isOpen}
              aria-controls={`admin-submenu-${key}`}
              onClick={() => toggleGroup(key)}
            >
              <GroupIcon size={17} />
              <span>{label}</span>
              <ChevronDown className="admin-menu-group-chevron" size={16} />
            </button>
            <div className="admin-submenu" id={`admin-submenu-${key}`} hidden={!isOpen}>
              {items.map(({ to, label: itemLabel, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `admin-menu-item admin-submenu-item${isActive ? ' active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{itemLabel}</span>
                </NavLink>
              ))}
            </div>
          </div>
          );
        })}
      </nav>
      <div className="sidebar-badge">
        {isSuperUser() ? 'Super User' : profile.dept_name || 'Department User'}
      </div>
    </aside>
  );
}
