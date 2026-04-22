'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/login.module.css';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-flight Validations
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Complete all identification fields to proceed.');
      return;
    }

    if (!email.includes('@')) {
      setError('Ensure the email address is valid.');
      return;
    }

    if (password.length < 8) {
      setError('For security, your password must exceed 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signup(name, email, password);

      if (result.success) {
        // Success: AuthProvider handles the session and redirection
        router.push('/');
      } else {
        setError(result.message || 'Identity creation failed. Please check your data.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Identity server connection failed. Try again in 30 seconds.');
      setIsLoading(false);
      console.error('Signup Failure:', err);
    }
  }, [name, email, password, signup, router]);

  return (
    <div className={styles.page}>
      {/* Create Account Core Card */}
      <div className={styles.card}>
        <div className={styles.cardGlow} />

        {/* Branding Unit */}
        <div className={styles.brand}>
          <div className={styles.logoContainer}>
            <div className={styles.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <h1 className={styles.logoText}>EYES</h1>
          <p className={styles.tagline}>Everything You Ever Said</p>
          <p className={styles.subtitle}>Let&apos;s build your digital memory vault. Private, secured, and uniquely yours.</p>
        </div>

        {/* Identity Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <div className={styles.error}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Full Name Interaction Zone */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="name">WHAT SHOULD WE CALL YOU?</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="name"
                type="text"
                className={styles.input}
                placeholder="How should EYES address you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Email Interaction Zone */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="email">WHAT&apos;S YOUR EMAIL ADDRESS?</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Interaction Zone */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="password">CHOOSE A SECURE PASSWORD</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            <span className={styles.btnContent}>
              {isLoading ? (
                <>
                  <span className={styles.btnSpinner} />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Create Identity
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </span>
          </button>

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <div className={styles.dividerLine} />
          </div>

          <p className={styles.switchText}>
            Registered before?{' '}
            <Link href="/login" className={styles.switchLink}>
              Login now
            </Link>
          </p>

          <div className={styles.features}>
            <span className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.featureIconGreen}`}>✓</span>
              Private Beta
            </span>
            <span className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.featureIconBlue}`}>✓</span>
              Zero-Trust
            </span>
            <span className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.featureIconPurple}`}>✓</span>
              Audit Ready
            </span>
          </div>
        </form>
      </div>

      <span className={styles.bottomText}>© 2026 EYES — EVERYTHING YOU EVER SAID</span>
    </div>
  );
}

