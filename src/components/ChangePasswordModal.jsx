import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import { getPasswordStrength } from '../utils/passwordStrength.js';

const emptyForm = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

function PasswordInput({ label, name, value, visible, error, children, onChange, onToggle }) {
  return (
    <label className="field password-field" htmlFor={`password-${name}`}>
      <span className="field-label">{label}<em>*</em></span>
      <span className="password-input-wrap">
        <input
          id={`password-${name}`}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
        />
        <button className="password-toggle" type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(emptyForm);
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
    if (!form.current_password) nextErrors.current_password = 'Current password is required.';
    if (!form.new_password) nextErrors.new_password = 'New password is required.';
    if (form.new_password && form.new_password.length < 6) nextErrors.new_password = 'New password must be at least 6 characters.';
    if (!form.confirm_password) nextErrors.confirm_password = 'Confirm password is required.';
    if (form.new_password && form.confirm_password && form.new_password !== form.confirm_password) {
      nextErrors.confirm_password = 'Passwords do not match';
    }
    if (form.current_password && form.new_password && form.current_password === form.new_password) {
      nextErrors.new_password = 'New password must be different from current password.';
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
      await axiosInstance.put('/api/admin/profile/change-password', form);
      setForm(emptyForm);
      onSuccess();
      onClose();
    } catch (err) {
      setServerError(err.friendlyMessage || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <form className="center-card password-modal" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Password</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close change password modal" disabled={loading}>
            <X size={19} />
          </button>
        </div>
        {serverError ? <div className="alert alert-error">{serverError}</div> : null}

        <PasswordInput
          label="Current Password"
          name="current_password"
          value={form.current_password}
          visible={visible.current_password}
          error={errors.current_password}
          onChange={update}
          onToggle={() => setVisible((current) => ({ ...current, current_password: !current.current_password }))}
        />

        <PasswordInput
          label="New Password"
          name="new_password"
          value={form.new_password}
          visible={visible.new_password}
          error={errors.new_password}
          onChange={update}
          onToggle={() => setVisible((current) => ({ ...current, new_password: !current.new_password }))}
        >
          {form.new_password ? <span className={`password-strength ${strength.tone}`}>{strength.label}</span> : null}
        </PasswordInput>

        <PasswordInput
          label="Confirm New Password"
          name="confirm_password"
          value={form.confirm_password}
          visible={visible.confirm_password}
          error={errors.confirm_password}
          onChange={update}
          onToggle={() => setVisible((current) => ({ ...current, confirm_password: !current.confirm_password }))}
        >
          {confirmTouched && !matches ? <span className="field-error">Passwords do not match</span> : null}
          {matches ? <span className="match-ok"><CheckCircle2 size={16} /> Passwords match</span> : null}
        </PasswordInput>

        <button className="download-button full-width" type="submit" disabled={loading} style={{ marginTop: '1rem' }}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
