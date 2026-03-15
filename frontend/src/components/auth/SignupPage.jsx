import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading, clearError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
    clearError();
  }, [isAuthenticated, navigate, clearError]);

  const getPasswordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Too short', color: '#ef4444', width: '20%' };
    if (p.length < 8) return { label: 'Weak', color: '#f97316', width: '40%' };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: 'Strong', color: '#22c55e', width: '100%' };
    return { label: 'Fair', color: '#eab308', width: '65%' };
  };
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError('Name is required'); return; }
    if (!email.trim()) { setFormError('Email is required'); return; }
    if (password.length < 6) { setFormError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="noise-overlay" aria-hidden="true" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-logo">
          <span className="logo-icon" aria-hidden="true">⬡</span>
          <span className="auth-logo-text">DocRule</span>
        </div>

        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">Start formatting documents with rules today</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signup-name">Full Name</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">👤</span>
              <input
                id="signup-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✉</span>
              <input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input
                id="signup-password"
                type={showPass ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
              />
              <button
                type="button"
                className="auth-toggle-pass"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {strength && (
              <div className="auth-password-strength">
                <div className="auth-strength-bar">
                  <div style={{ width: strength.width, background: strength.color, height: '100%', borderRadius: 4, transition: 'all 0.3s' }} />
                </div>
                <span style={{ color: strength.color, fontSize: '0.75rem' }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input
                id="signup-confirm"
                type={showPass ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
          </div>

          {formError && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              ⚠ {formError}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className="auth-submit-btn"
            disabled={submitting || loading}
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
          >
            {submitting ? (
              <span className="auth-btn-loading">
                <span className="auth-spinner" /> Creating account…
              </span>
            ) : 'Create account'}
          </motion.button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
