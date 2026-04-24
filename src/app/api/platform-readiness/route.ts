import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

type PlatformId = 
  | 'reddit' | 'gmail' | 'github' | 'notion' | 'google-calendar' | 'discord' | 'slack' | 'twitter' | 'dropbox'
  | 'outlook' | 'asana' | 'trello' | 'linear' | 'clickup'
  | 'vercel' | 'netlify' | 'supabase' | 'sentry' | 'posthog' | 'webflow' | 'devin' | 'cursor'
  | 'canva' | 'granola'
  | 'strava' | 'fitbit' | 'oura' | 'withings'
  | 'mercury' | 'ramp' | 'navan'
  | 'sonos' | 'philips-hue';

type PlatformReadiness = {
  id: PlatformId;
  name: string;
  connectionType: 'OAuth' | 'APIKey';
  requiredScopes: string[];
  optional: boolean;
  deferred: boolean;
  configured: boolean;
  missingEnv: string[];
  connected: boolean;
  status: 'idle' | 'connecting' | 'authenticating' | 'syncing' | 'connected' | 'error';
  syncProgress: number;
  items: number;
  lastSyncAt: string | null;
  errorMessage: string | null;
};

const platformConfigs: Array<{
  id: PlatformId;
  name: string;
  env: string[];
  scopes: string[];
  optional?: boolean;
}> = [
  {
    id: 'github',
    name: 'GitHub',
    env: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read:user', 'repo'],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['gmail.readonly', 'openid', 'email', 'profile'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['calendar.readonly', 'openid', 'email', 'profile'],
  },
  {
    id: 'outlook',
    name: 'Outlook',
    env: ['OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['mail.read', 'calendars.read'],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    env: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['identity', 'history', 'read', 'mysubreddits'],
    optional: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    env: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read content', 'read user'],
  },
  {
    id: 'slack',
    name: 'Slack',
    env: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history'],
  },
  {
    id: 'discord',
    name: 'Discord',
    env: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['identify', 'email'],
  },
  {
    id: 'twitter',
    name: 'Twitter (X)',
    env: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['tweet.read', 'users.read'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    env: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['files.metadata.read'],
  },
  {
    id: 'asana',
    name: 'Asana',
    env: ['ASANA_CLIENT_ID', 'ASANA_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['default'],
  },
  {
    id: 'trello',
    name: 'Trello',
    env: ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'linear',
    name: 'Linear',
    env: ['LINEAR_CLIENT_ID', 'LINEAR_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    env: ['CLICKUP_CLIENT_ID', 'CLICKUP_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    env: ['VERCEL_API_TOKEN'],
    scopes: ['read'],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    env: ['NETLIFY_CLIENT_ID', 'NETLIFY_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    env: ['SUPABASE_ACCESS_TOKEN'],
    scopes: ['read'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    env: ['SENTRY_AUTH_TOKEN'],
    scopes: ['event:read', 'project:read'],
  },
  {
    id: 'posthog',
    name: 'PostHog',
    env: ['POSTHOG_API_KEY'],
    scopes: ['read'],
  },
  {
    id: 'webflow',
    name: 'Webflow',
    env: ['WEBFLOW_CLIENT_ID', 'WEBFLOW_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'devin',
    name: 'Devin',
    env: ['DEVIN_API_KEY'],
    scopes: ['read'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    env: ['CURSOR_API_KEY'],
    scopes: ['read'],
  },
  {
    id: 'canva',
    name: 'Canva',
    env: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'granola',
    name: 'Granola',
    env: ['GRANOLA_API_KEY'],
    scopes: ['read'],
  },
  {
    id: 'strava',
    name: 'Strava',
    env: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['activity:read_all'],
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    env: ['FITBIT_CLIENT_ID', 'FITBIT_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['activity', 'heartrate', 'profile', 'sleep'],
  },
  {
    id: 'oura',
    name: 'Oura',
    env: ['OURA_CLIENT_ID', 'OURA_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['personal', 'daily'],
  },
  {
    id: 'withings',
    name: 'Withings',
    env: ['WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['user.metrics'],
  },
  {
    id: 'mercury',
    name: 'Mercury',
    env: ['MERCURY_API_KEY'],
    scopes: ['read'],
  },
  {
    id: 'ramp',
    name: 'Ramp',
    env: ['RAMP_CLIENT_ID', 'RAMP_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['read'],
  },
  {
    id: 'navan',
    name: 'Navan',
    env: ['NAVAN_API_KEY'],
    scopes: ['read'],
  },
];

const toDbPlatform = (id: PlatformId) => (id === 'google-calendar' ? 'google_calendar' : (id === 'twitter' ? 'twitter' : id));

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    let tokenRows: Array<{ platform: string }> = [];
    let syncRows: Array<{
      platform: string;
      status: string | null;
      sync_progress: number | null;
      total_items: number | null;
      last_sync_at: string | null;
      error_message: string | null;
    }> = [];

    if (user) {
      const [{ data: tokens }, { data: sync }] = await Promise.all([
        supabase
          .from('oauth_tokens')
          .select('platform')
          .eq('user_id', user.id),
        supabase
          .from('sync_status')
          .select('platform,status,sync_progress,total_items,last_sync_at,error_message')
          .eq('user_id', user.id),
      ]);

      tokenRows = tokens ?? [];
      syncRows = sync ?? [];
    }

    const tokenSet = new Set(tokenRows.map((row) => row.platform));
    const syncMap = new Map(syncRows.map((row) => [row.platform, row]));

    const platforms: PlatformReadiness[] = platformConfigs.map((cfg) => {
      const missingEnv = cfg.env.filter((key) => !process.env[key]);
      const configured = missingEnv.length === 0;
      const deferred = Boolean(cfg.optional && !configured);
      const dbId = toDbPlatform(cfg.id);
      const sync = syncMap.get(dbId);
      const status = (sync?.status ?? 'idle') as PlatformReadiness['status'];
      const connected = tokenSet.has(dbId) || ['connected', 'syncing', 'authenticating', 'connecting'].includes(status);

      return {
        id: cfg.id,
        name: cfg.name,
        connectionType: cfg.env.some(e => e.includes('TOKEN') || e.includes('KEY')) ? 'APIKey' : 'OAuth',
        requiredScopes: cfg.scopes,
        optional: Boolean(cfg.optional),
        deferred,
        configured,
        missingEnv,
        connected,
        status,
        syncProgress: sync?.sync_progress ?? 0,
        items: sync?.total_items ?? 0,
        lastSyncAt: sync?.last_sync_at ?? null,
        errorMessage: sync?.error_message ?? null,
      };
    });

    return NextResponse.json({ platforms }, { status: 200 });
  } catch (error) {
    console.error('platform-readiness error:', error);
    return NextResponse.json({ platforms: [] }, { status: 200 });
  }
}
