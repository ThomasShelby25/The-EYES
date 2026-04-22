import React from 'react';

/**
 * SOURCE OF TRUTH FOR PLATFORM ICONS
 * These icons are highly detailed and use official brand colors.
 */

export function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>; }
export function SearchIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
export function ArrowRightIcon() { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }

export function RedditIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <circle cx="128" cy="128" r="128" fill="#FF4500"/>
      <path fill="#FFF" d="M213.2 129.2a18.6 18.6 0 00-18.7-18.6c-4.8 0-9.2 1.8-12.6 4.8-12.8-8.9-30.3-14.7-49.8-15.5l8.5-40 27.8 5.9c.3 7 6.1 12.6 13.3 12.6a13.3 13.3 0 100-26.6c-5.2 0-9.8 3-11.9 7.5l-31-6.6a2.3 2.3 0 00-2.4.5 2.3 2.3 0 00-1.4 2.1l-9.5 44.5c-19.8.6-37.7 6.6-50.6 15.6a18.7 18.7 0 00-12.7-5.1 18.6 18.6 0 000 37.2c0 2.2.3 4.4.8 6.5-1.5-.2-3.1-.3-4.7-.3-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32c0-2-.2-4-.6-5.8 19 5.5 41.5 8.8 65.8 8.8 24.3 0 46.8-3.2 65.8-8.8-.4 1.8-.6 3.8-.6 5.8 0 17.7 14.3 32 32 32s32-14.3 32-32-14.3-32-32-32c-1.6 0-3.2.1-4.7.3.5-2.1.8-4.3.8-6.5 0-7.6-4.6-14-11-17a18.6 18.6 0 000-10.3zm-128 13.3a13.3 13.3 0 1126.6 0 13.3 13.3 0 01-26.6 0zm74.3 35.3c-9.2 9.1-26.6 9.7-31.6 9.7-5.2 0-22.6-.7-31.6-9.7a3.4 3.4 0 014.9-4.8c5.8 5.8 18 7.8 26.7 7.8s20.9-2 26.7-7.8a3.4 3.4 0 014.9 4.8zm-2.4-21.9a13.3 13.3 0 110-26.6 13.3 13.3 0 010 26.6z"/>
    </svg>
  );
}

export function GitHubIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 250" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="var(--text-primary)" d="M128 0C57.3 0 0 57.3 0 128c0 56.5 36.7 104.5 87.5 121.5 6.4 1.2 8.7-2.8 8.7-6.2 0-3-.1-13.1-.2-23.8-35.6 7.7-43.1-15.1-43.1-15.1-5.8-14.8-14.2-18.7-14.2-18.7-11.6-8 .9-7.8.9-7.8 12.9.9 19.6 13.2 19.6 13.2 11.4 19.6 29.9 13.9 37.2 10.6 1.2-8.3 4.5-13.9 8.1-17.1-28.4-3.2-58.3-14.2-58.3-63.3 0-14 5-25.4 13.2-34.4-1.3-3.2-5.7-16.2 1.2-33.9 0 0 10.7-3.4 35.2 13.1 10.2-2.8 21.2-4.3 32-4.3s21.8 1.5 32 4.3c24.5-16.5 35.2-13.1 35.2-13.1 7 17.6 2.6 30.7 1.3 33.9 8.2 9 13.2 20.4 13.2 34.4 0 49.2-29.9 60-58.4 63.2 4.6 4 8.7 11.8 8.7 23.7 0 17.1-.1 30.9-.1 35.1 0 3.4 2.3 7.4 8.8 6.1C219.4 232.5 256 184.5 256 128 256 57.3 198.7 0 128 0z"/>
    </svg>
  );
}

export function GmailIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 193" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#4285f4" d="M58.2 192V93.1L27.5 65.1 0 49.5v125.1c0 9.7 7.8 17.5 17.5 17.5h40.7z"/>
      <path fill="#34a853" d="M197.8 192h40.7c9.7 0 17.5-7.8 17.5-17.5V49.5l-31.2 17.8-27 25.8V192z"/>
      <path fill="#ea4335" d="M58.2 93.1V17.5L128 70l69.8-52.5v75.6L128 145.5l-69.8-52.4z"/>
      <path fill="#fbbc04" d="M197.8 17.5V93.1l58.2-43.6V26.2c0-21.6-24.6-33.9-41.9-20.9l-16.3 12.2z"/>
      <path fill="#c5221f" d="M0 49.5l26.8 20.1 31.4 23.5V17.5L41.9 5.3C24.6-7.7 0 4.6 0 26.2v23.3z"/>
    </svg>
  );
}

export function CalendarIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#fff" d="M195.4 60.6H60.6v134.8h134.8V60.6z"/>
      <path fill="#ea4335" d="M195.4 256L256 195.4l-30.3-5.2-30.3 5.2V256z"/>
      <path fill="#188038" d="M0 195.4v40.4C0 247 9 256 20.2 256h40.4v-60.6H0z"/>
      <path fill="#1967d2" d="M256 60.6V20.2C256 9 247 0 235.8 0h-40.4v60.6H256z"/>
      <path fill="#fbbc04" d="M60.6 0H20.2C9 0 0 9 0 20.2v40.4h60.6V0z"/>
      <path fill="#4285f4" d="M195.4 60.6v134.8H60.6V60.6h134.8z"/>
      <path d="M156.4 101.4c0-1.9-.4-3.3-1.3-4.3-.9-1-2.1-1.5-3.8-1.5s-2.9.5-3.8 1.5c-.8 1-1.3 2.4-1.3 4.3v34.5c0 1.9.4 3.3 1.3 4.3.9 1 2.1 1.5 3.8 1.5s2.9-.5 3.8-1.5c.8-1 1.3-2.4 1.3-4.3v-34.5zM114.7 135.1c0 1.3.2 2.2.8 2.9.5.7 1.3 1 2.2 1s1.7-.3 2.2-1 .8-1.6.8-2.9V102.3c0-1.3-.2-2.2-.8-2.9-.5-.7-1.3-1-2.2-1s-1.7.3-2.2 1-.8 1.6-.8 2.9v32.8z" fill="#fff"/>
    </svg>
  );
}

export function NotionIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="white" d="M16 11.5L164 0l34.3 7.8 47.2 33.3c10.4 7.3 10.4 8.3 10.4 14.6v182.5c0 11.4-4.2 18.2-18.7 19.2L65.4 267.4c-11 .5-16-1.1-21.8-8.3L8.8 213.8C2.6 205.5 0 199.3 0 192V29.7c0-9.4 4.2-17.2 16.1-18.2z"/>
      <path fill="black" d="M50.9 32.2L183.6 22.8l44.6 53.1c2.1 2.1 3.1 4.2 3.1 7.3V229.6c0 4.2-1.6 7.3-5.7 7.8l-132.6 8.8c-5.7.5-8.3-1-10.9-4.2L38.5 186.1c-2.1-3.1-3.1-5.2-3.1-10.4V32.2c0-4.7 6.2-6.8 15.5-1.1z"/>
      <path fill="white" d="M71.7 189.2h3.1V72.9l-15.1 9.4v72.9c0 7.3 5.7 14.6 11.9 21.3"/>
      <path fill="white" d="M177.9 56.6l-45.2 71-24.9-40-41 10.4v93.4c0 6.2-11.9 0-11.9 14s4.2 4.2 4.2 8.3c0 4.2 6.8 3.6 12.5-.5 5.7-4.1 11.9-2.6 11.9-6.8v-2.1c0-2.1-.5-4.2-2.1-5.7l-8.8-6.8c-3.6-3.1 7.3-2.6 15.1 2.1l109.6 6.7c4.2-3.1 7.3-8.8 7.3-13V65.1l-12.5-8.5z"/>
      <path fill="black" d="M129.3 143.7l44.7-71 6.2 4.2v112.4h-3.1l-4.2.5v-91L152.1 131.7l-22.8 12z"/>
    </svg>
  );
}

export function SlackIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#e01e5a" d="M53.8 161.3c0 14.8-12 26.8-26.8 26.8S.2 176.1.2 161.3s12-26.8 26.8-26.8h26.8v12.9z"/>
      <path fill="#e01e5a" d="M67.2 161.3c0-14.8 12-26.8 26.8-26.8s26.8 12 26.8 26.8v67c0 14.8-12 26.8-26.8 26.8s-26.8-12-26.8-26.8v-67z"/>
      <path fill="#36c5f0" d="M94.1 53.8c-14.8 0-26.8-12-26.8-26.8S79.3.2 94.1.2s26.8 12 26.8 26.8v26.8h-12.9z"/>
      <path fill="#36c5f0" d="M94.1 67.2c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8H27c-14.8 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8h67.1z"/>
      <path fill="#2eb67d" d="M202.2 94.7c0-14.8 12-26.8 26.8-26.8s26.8 12 26.8 26.8-12 26.8-26.8 26.8h-26.8V94.7z"/>
      <path fill="#2eb67d" d="M188.8 94.7c0 14.8-12 26.8-26.8 26.8s-26.8-12-26.8-26.8V27.7c0-14.8 12-26.8 26.8-26.8s26.8 12 26.8 26.8v67z"/>
      <path fill="#ecb22e" d="M161.9 202.2c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8-26.8-12-26.8-26.8v-26.8h12.9z"/>
      <path fill="#ecb22e" d="M161.9 188.8c-14.8 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8h67.1c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8h-67.1z"/>
    </svg>
  );
}

export function LinkedInIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#0077b5" d="M256 256h-60v-94.3c0-22.5-.4-51.5-31.4-51.5-31.4 0-36.2 24.5-36.2 49.9V256h-60V64h57.6v26.2h.8c8-15.2 27.6-31.2 56.8-31.2 60.8 0 72 40 72 92.1V256zM28.4 64h60v192h-60V64zM58.4 0c19.2 0 34.8 15.6 34.8 34.8s-15.6 34.8-34.8 34.8S23.6 54 23.6 34.8 39.2 0 58.4 0z"/>
    </svg>
  );
}

export function DiscordIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 199" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#5865f2" d="M216.9 16.6A208.5 208.5 0 00164 0c-2.3 4.1-4.9 9.6-6.8 14q-29.5-4.4-58.5 0c-1.8-4.4-4.5-9.9-6.8-14a207.8 207.8 0 00-52.9 16.6C5.6 67.1-3.4 116.4 1.1 165c22.2 16.6 43.7 26.6 64.8 33.2 5.1-6.9 9.4-14.7 12.8-22.9-7.6-2.9-14.9-6.4-21.8-10.6l5.4-4.2c42.1 19.7 87.9 19.7 129.5 0l5.4 4.2c-7 4.2-14.3 7.8-21.9 10.7 3.4 8.2 7.7 16 12.8 22.8 21.1-6.6 42.6-16.6 64.8-33.2 5.3-56.3-9.1-105.1-38.1-148.4M85.5 135.1c-12.6 0-23-11.8-23-26.2s10.1-26.2 23-26.2 23.2 11.8 23 26.2c0 14.4-10.1 26.2-23 26.2m85 0c-12.6 0-23-11.8-23-26.2s10.1-26.2 23-26.2 12.9 0 23.2 11.8s-.2 26.2-13 26.2"/>
    </svg>
  );
}

export function XIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="var(--text-primary)" d="M149.1 108.4L242.3 0h-22.1l-81 94.1L74.6 0H0l97.8 142.3L0 256h22.1l85.5-99.4L183.7 256h72.3l-106.9-147.6zm-30.3 35.2l-9.9-14.2L30 16.7h33.9l63.6 91 9.9 14.2 82.7 118.3h-33.9l-67.5-96.5z"/>
    </svg>
  );
}

export function DropboxIconOfficial({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path fill="#0061ff" d="M64 25.1l64 41.5-64 41.5L0 66.6 64 25.1zM192 25.1l64 41.5-64 41.5-64-41.5 64-41.5zM0 149.6l64-41.5 64 41.5-64 41.5L0 149.6zM192 108.1l64 41.5-64 41.5-64-41.5 64-41.5zM64 201l64 41.5 64-41.5-64-41.5L64 201z"/>
    </svg>
  );
}
