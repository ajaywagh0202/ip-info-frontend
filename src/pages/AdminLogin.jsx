import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, LogIn } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import InputField from '../components/InputField.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import logo from '../assets/indian.png'

export default function AdminLogin() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!credentials.username.trim() || !credentials.password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.post('/api/admin/login', {
        username: credentials.username.trim(),
        password: credentials.password,
      });
      const token = data?.token || data?.accessToken || data?.jwt;
      if (!token) throw new Error('Login response did not include a token.');
      localStorage.setItem('adminToken', token);
      navigate('/admin/dashboard', { replace: true });
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="center-card login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-mark" aria-hidden="true">
          {/* <TrainFront size={30} /> */}
          <img src={logo} alt="Indian Railways Logo" className="logo-image" />
        </div>
        <p className="section-kicker">
          <LockKeyhole size={16} />
          Central Railways IT
        </p>
        <h1>Admin Login</h1>
        <p>Sign in to review registered scanner records.</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="form-grid single">
          <InputField
            label="Username"
            name="username"
            required
            value={credentials.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <InputField
            label="Password"
            name="password"
            type="password"
            required
            value={credentials.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </div>

        <button className="primary-button full-width" type="submit" disabled={loading}>
          {loading ? <LoadingSpinner label="Signing in" /> : <><LogIn size={18} /> Login</>}
        </button>
      </form>
    </section>
  );
}
