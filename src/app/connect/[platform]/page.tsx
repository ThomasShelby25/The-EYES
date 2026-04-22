'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * DEPRECATED: Platform details pages have been moved to the unified dashboard cards.
 * This route remains as a redirect target to prevent 404s for old user bookmarks.
 */
export default function ConnectPlatformPage() {
  const router = useRouter();
  
  useEffect(() => {
     // Redirect to the dashboard hub where platform management now lives
     router.replace('/?view=readiness');
  }, [router]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#F8F5F2',
      gap: '12px'
    }}>
      <p style={{ 
        fontFamily: 'Georgia, serif', 
        fontSize: '1.2rem',
        color: '#1D1C16',
        margin: 0
      }}>
        Moving to Command Center...
      </p>
      <div style={{
        width: '40px',
        height: '2px',
        background: '#1D1C16',
        opacity: 0.2
      }} />
    </div>
  );
}
