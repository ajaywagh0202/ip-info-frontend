import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Info, X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import { getPasswordStrength } from '../utils/passwordStrength.js';

function getUserId(user) {
  return user?.id || user?._id || user?.user_id;
}

export default function ResetUserPasswordModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => getPasswordStrength(form.new_password), [form.new_password]);
  const confirmTouched = form.confirm_password.length > 0;
  const matches = confirmTouched && form.new_password === form.confirm_password;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onClose]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.new_password) nextErrors.new_password = 'New password is required.';
    if (form.new_password && form.new_password.length < 6) nextErrors.new_password = 'New password must be at least 6 characters.';
    if (!form.confirm_password) nextErrors.confirm_password = 'Confirm password is required.';
    if (form.new_password && form.confirm_password && form.new_password !== form.confirm_password) {
      nextErrors.confirm_password = 'Passwords do not match';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await axiosInstance.put(`/api/admin/users/${getUserId(user)}/reset-password`, form);
      onSuccess(user);
      onClose();
    } catch (err) {
      setServerError(err.friendlyMessage || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <form className="center-card password-modal" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Reset Password</h2>
            <p className="modal-subtitle">Resetting password for: {user?.name || 'User'} (@{user?.username || 'username'})</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close reset password modal" disabled={loading}>
            <X size={19} />
          </button>
        </div>
        {serverError ? <div className="alert alert-error">{serverError}</div> : null}

        <label className="field password-field" htmlFor="reset-new-password">
          <span className="field-label">New Password<em>*</em></span>
          <span className="password-input-wrap">
            <input id="reset-new-password" name="new_password" type={visible.new_password ? 'text' : 'password'} value={form.new_password} onChange={update} />
            <button className="password-toggle" type="button" onClick={() => setVisible((current) => ({ ...current, new_password: !current.new_password }))} aria-label="Toggle new password visibility">
              {visible.new_password ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          {form.new_password ? <span className={`password-strength ${strength.tone}`}>{strength.label}</span> : null}
          {errors.new_password ? <span className="field-error">{errors.new_password}</span> : null}
        </label>

        <label className="field password-field" htmlFor="reset-confirm-password">
          <span className="field-label">Confirm New Password<em>*</em></span>
          <span className="password-input-wrap">
            <input id="reset-confirm-password" name="confirm_password" type={visible.confirm_password ? 'text' : 'password'} value={form.confirm_password} onChange={update} />
            <button className="password-toggle" type="button" onClick={() => setVisible((current) => ({ ...current, confirm_password: !current.confirm_password }))} aria-label="Toggle confirm password visibility">
              {visible.confirm_password ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          {confirmTouched && !matches ? <span className="field-error">Passwords do not match</span> : null}
          {matches ? <span className="match-ok"><CheckCircle2 size={16} /> Passwords match</span> : null}
          {errors.confirm_password ? <span className="field-error">{errors.confirm_password}</span> : null}
        </label>

        <p className="info-note"><Info size={16} /> The user will need to log in again with their new password.</p>
        <button className="download-button full-width" type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
