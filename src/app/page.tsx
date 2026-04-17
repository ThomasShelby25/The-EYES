'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MainContent from '@/components/MainContent';
import styles from './page.module.css';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSystemBooting, setIsSystemBooting] = useState(true);

  // Synchronize loading across components
  const handleBootComplete = () => {
    // Artificial delay for that premium 'handshake' feel
    setTimeout(() => setIsSystemBooting(false), 200);
  };

  return (
    <div className={styles.pageRoot}>
      <div className="neural-bg" />
      <div className="scanline" />
      {isSystemBooting && (
        <div className={styles.globalBootLoader}>
          <div className={styles.bootText}>
            INITIALIZING EYES NEURAL LINK...
          </div>
          <div className={styles.bootProgressLine} />
        </div>
      )}
      <div 
        className={`${styles.sidebarWrapper} ${isSystemBooting ? styles.hidden : ''} ${isSidebarOpen ? styles.sidebarVisible : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <Sidebar />
      </div>
      <div className={`${styles.headerWrapper} ${isSystemBooting ? styles.hidden : ''}`}>
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>
      <div className={`${styles.mainWrapper} ${isSystemBooting ? styles.hidden : ''}`}>
        <MainContent onLoaded={handleBootComplete} />
      </div>

      {isSidebarOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
    </div>
  );
}

