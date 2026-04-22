'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-flight Validations
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    if (!email.includes('@')) {
      setError('Invalid email format. Try something like user@domain.com.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        // Success: Context handles user state and AuthProvider handles redirection
        // but we'll also trigger navigation as a fallback
        router.push('/');
      } else {
        setError(result.message || 'Sign-in failed. Please check your credentials.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('An unexpected network error occurred. Please try again.');
      setIsLoading(false);
      console.error('Login Failure:', err);
    }
  }, [email, password, login, router]);

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginContent}>
        {/* Left Section: Auth & Headline */}
        <div className={styles.authSection}>
          <div className={styles.header}>
            <div className={styles.logoRow}>
               <div className={styles.logoIconMini}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
               </div>
               <span className={styles.logoTextMini}>The EYES</span>
            </div>
          </div>

          <div className={styles.authHero}>
            <h1 className={styles.megaHeroTitle}>Your Digital<br />Collective Memory</h1>
            <p className={styles.heroSubText}>Deep context analysis across every conversation, thread, and document you&apos;ve ever touched.</p>
          </div>

          <div className={styles.authCardWrapper}>
            <div className={styles.authCard}>
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.socialAuthRow}>
                  <button type="button" className={styles.socialBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <div className={styles.authDivider}>
                  <span>OR</span>
                </div>

                {error && <div className={styles.inlineError}>{error}</div>}

                <div className={styles.inputStack}>
                  <div className={styles.fieldGroup}>
                    <input
                      type="email"
                      className={styles.elegantInput}
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={styles.elegantInput}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className={styles.eyeToggle}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.primaryAuthBtn}
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Continue with email'}
                </button>
              </form>
            </div>
            
            <p className={styles.authFooterLink}>
               New to EYES? <Link href="/signup">Create account</Link>
            </p>
          </div>
        </div>

        {/* Right Section: Showcase Card */}
        <div className={styles.visualSection}>
          <div className={styles.showcaseOuter}>
             <div className={styles.showcaseCard}>
                <div className={styles.abstractVisual}>
                  {/* Signature Visual Placeholder */}
                  <div className={styles.vaultWindow}>
                    <div className={styles.vaultSidebar}>
                      <div className={`${styles.sidebarItem} ${styles.sidebarItemActive}`} style={{ width: '80%' }} />
                      <div className={styles.sidebarItem} style={{ width: '60%' }} />
                      <div className={styles.sidebarItem} style={{ width: '70%' }} />
                      <div className={styles.sidebarItem} style={{ width: '50%' }} />
                    </div>
                    <div className={styles.vaultMain}>
                      <div className={styles.vaultHeader}>
                        <div className={styles.sidebarItem} style={{ width: '100px', height: '12px' }} />
                        <div className={styles.vaultSearch} />
                      </div>
                      <div className={styles.vaultGrid}>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className={styles.vaultCard}>
                            <div className={styles.vaultCardIcon} />
                            <div className={styles.vaultCardLines}>
                              <div className={styles.vaultLine} />
                              <div className={`${styles.vaultLine} ${styles.vaultLineShort}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={styles.vaultBadge}>SECURED BY EYES</div>
                  </div>
                  <div className={styles.visualGlow} />
                  <div className={styles.visualTitle}>EYES</div>
                  <div className={styles.visualTagline}>The AI for deep context</div>
                </div>
                
                <div className={styles.showcaseFooter}>
                   <div className={styles.showcaseBadge}>V1.2.0</div>
                   <div className={styles.showcaseBadge}>Secured</div>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      <div className={styles.legalFooter}>
        <span>© 2026 EYES — Built for Privacy</span>
        <div className={styles.legalLinks}>
           <Link href="/terms">Terms</Link>
           <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </div>
  );
}

