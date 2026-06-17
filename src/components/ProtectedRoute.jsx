import { Navigate } from 'react-router-dom';
import { getToken, isSuperUser } from '../utils/adminAuth.js';

export function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />;
}

export function SuperRoute({ children }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return isSuperUser() ? children : <Navigate to="/admin/dashboard" replace />;
}
