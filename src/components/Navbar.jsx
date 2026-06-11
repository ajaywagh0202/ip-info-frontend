import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import logo from '../assets/indian.png';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to="/">
          <span className="brand-icon" aria-hidden="true">
            <img src={logo} alt="" className="logo-image" />
          </span>
          <span>
            <strong>Indian Railways IT Cell</strong>
            <small>Secure device inventory</small>
          </span>
        </Link>

        <h1 className="portal-title">{isAdmin ? 'Admin Dashboard' : 'Register My Device Portal'}</h1>

        <button className="admin-outline-button" type="button" onClick={() => navigate('/admin/login')}>
          <ShieldCheck size={16} />
          Admin
        </button>
      </div>
    </header>
  );
}
