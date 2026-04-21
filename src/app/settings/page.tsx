'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import styles from './settings.module.css';

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security'>('profile');

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
                    <input type="text" placeholder="Thomas Shelby" className={styles.input} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>EMAIL ADDRESS</label>
                    <input type="email" placeholder="thomasshelby25@example.com" className={styles.input} disabled />
                  </div>
                  <button className={styles.saveBtn}>Update Profile</button>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className={styles.appearanceSection}>
                  <div className={styles.themeGrid}>
                    <div 
                      className={`${styles.themeCard} ${theme === 'dark' ? styles.themeActive : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <div className={styles.themePreviewDark} />
                      <span>Obsidian (Dark)</span>
                    </div>
                    <div 
                      className={`${styles.themeCard} ${theme === 'light' ? styles.themeActive : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <div className={styles.themePreviewLight} />
                      <span>Crystal (Light)</span>
                    </div>
                  </div>
                  <p className={styles.helpText}>Light mode is currently in experimental preview.</p>
                </div>
              )}

              {activeTab === 'security' && (
                <div className={styles.securitySection}>
                  <div className={styles.securityInfo}>
                    <h3>OAuth Connections</h3>
                    <p>Your account is linked via ThomasShelby25 GitHub.</p>
                  </div>
                  <button className={styles.dangerBtn}>Disconnect Account</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
