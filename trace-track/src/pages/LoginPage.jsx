import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('madanraj73ashok@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const messages = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found. Sign up first.',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'Email already registered. Try signing in.',
        'auth/weak-password': 'Password must be at least 6 characters',
        'auth/invalid-credential': 'Invalid email or password',
      };
      setError(messages[err.code] || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Title */}
        <div className="login-logo">
          <h1 className="login-title">TRACE</h1>
          <p className="login-subtitle">Track · Protect · Recover</p>
        </div>

        {/* Form Card */}
        <form className="login-card" onSubmit={handleSubmit}>
          <h2 className="login-card-title">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="login-error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              isSignup ? 'Sign Up' : 'Sign In'
            )}
          </button>

          <div className="login-toggle">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="login-toggle-btn"
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>

        <p className="login-footer">
          UPI Fraud Detection · Proportional Freeze
        </p>
      </div>
    </div>
  );
}
