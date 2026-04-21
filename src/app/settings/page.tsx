'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import styles from './settings.module.css';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    setTheme(currentTheme);
    if (user?.name) setDisplayName(user.name);
  }, [user]);

  const handleUpdateTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('eyes-theme', newTheme);
  };

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      // Logic to persist display name
      console.log('Updating profile to:', displayName);
      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setSaveStatus('Profile updated successfully!');
    } catch (e) {
      setSaveStatus('Failed to update.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <div className="neural-bg" />
      <div className="scanline" />
      
      <div className={styles.sidebarWrapper}>
        <Sidebar />
      </div>

      <div className={styles.headerWrapper}>
        <Header />
      </div>

      <div className={styles.mainWrapper}>
        <div className={styles.container}>
          <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
          
          <h1 className={styles.title}>Account Settings</h1>
          <p className={styles.subtitle}>Manage your digital identity and neural interface preferences.</p>

          <div className={styles.contentLayout}>
            {/* Tabs Sidebar */}
            <div className={styles.tabList}>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                Profile Details
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                Neural Theme
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'security' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('security')}
              >
                Secure Access
              </button>
            </div>

            {/* Tab Content */}
            <div className={styles.panel}>
              {activeTab === 'profile' && (
                <div className={styles.profileSection}>
                  <div className={styles.fieldGroup}>
                    <label>DISPLAY NAME</label>
                    <input 
                      type="text" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={styles.input} 
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>EMAIL ADDRESS</label>
                    <input type="email" value={user?.email || ''} className={styles.input} disabled />
                  </div>
                  
                  {saveStatus && <p className={saveStatus.includes('success') ? styles.successText : styles.errorText}>{saveStatus}</p>}
                  
                  <button 
                    className={styles.saveBtn} 
                    onClick={handleUpdateProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className={styles.appearanceSection}>
                  <div className={styles.themeGrid}>
                    <div 
                      className={`${styles.themeCard} ${theme === 'dark' ? styles.themeActive : ''}`}
                      onClick={() => handleUpdateTheme('dark')}
                    >
                      <div className={styles.themePreviewDark} />
                      <span>Obsidian (Dark)</span>
                    </div>
                    <div 
                      className={`${styles.themeCard} ${theme === 'light' ? styles.themeActive : ''}`}
                      onClick={() => handleUpdateTheme('light')}
                    >
                      <div className={styles.themePreviewLight} />
                      <span>Crystal (Light)</span>
                    </div>
                  </div>
                  <p className={styles.helpText}>Settings are applied instantly to your neural link.</p>
                </div>
              )}

              {activeTab === 'security' && (
                <div className={styles.securitySection}>
                  <div className={styles.securityInfo}>
                    <h3>OAuth Connections</h3>
                    <p>Your account is currently secured via GitHub.</p>
                  </div>
                  <button className={styles.dangerBtn} disabled>Disconnect Account</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
