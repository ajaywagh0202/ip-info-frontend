import { useEffect, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import { getAdminProfile } from '../utils/adminAuth.js';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function ProfileDropdown({ onChangePassword, onLogout }) {
  const baseProfile = getAdminProfile();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(baseProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get('/api/admin/profile/me')
      .then(({ data }) => {
        const nextProfile = data?.data || data?.user || data || {};
        if (active) setProfile((current) => ({ ...current, ...nextProfile }));
      })
      .catch((err) => {
        if (active) setError(err.friendlyMessage || 'Unable to load profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const name = profile.name || 'Admin';
  const userType = Number(profile.user_type);

  return (
    <div className="profile-dropdown" ref={ref}>
      <button className="profile-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className="profile-avatar" aria-hidden="true">
          <i className="fa-solid fa-user-tie" />
        </span>
        <span className="profile-name">{name}</span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="profile-menu">
          <section className="profile-card">
            {loading ? (
              <LoadingSpinner label="Loading profile" />
            ) : (
              <>
                <span className="profile-avatar large" aria-hidden="true">
                  <i className="fa-solid fa-user-tie" />
                </span>
                <strong>{name}</strong>
                <span>@{profile.username || 'username'}</span>
                <span>{profile.designation || 'Designation'}</span>
                <span>{profile.dept_name || 'Department'}</span>
                <b>{userType === 0 ? 'Super User' : 'Dept. User'}</b>
              </>
            )}
            {error ? <span className="field-error">{error}</span> : null}
          </section>
          <div className="profile-menu-divider" />
          <button className="profile-menu-item" type="button" onClick={() => { setOpen(false); onChangePassword(); }}>
            <KeyRound size={17} />
            Change Password
          </button>
          <button className="profile-menu-item danger" type="button" onClick={onLogout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
