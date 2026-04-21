import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

type PlatformId = 'reddit' | 'gmail' | 'github' | 'notion' | 'google-calendar' | 'discord' | 'slack' | 'twitter';

type PlatformReadiness = {
  id: PlatformId;
  name: string;
  connectionType: 'OAuth';
  requiredScopes: string[];
  optional: boolean;
  deferred: boolean;
  configured: boolean;
  missingEnv: string[];
  connected: boolean;
  status: 'idle' | 'connecting' | 'authenticating' | 'syncing' | 'connected' | 'error';
  syncProgress: number;
  totalItems: number;
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
    id: 'discord',
    name: 'Discord',
    env: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['identify', 'email'],
  },
  {
    id: 'slack',
    name: 'Slack',
    env: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'NEXT_PUBLIC_SITE_URL', 'TOKEN_ENCRYPTION_KEY'],
    scopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history'],
  },
];

const toDbPlatform = (id: PlatformId) => (id === 'google-calendar' ? 'google_calendar' : id);

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
        connectionType: 'OAuth',
        requiredScopes: cfg.scopes,
        optional: Boolean(cfg.optional),
        deferred,
        configured,
        missingEnv,
        connected,
        status,
        syncProgress: sync?.sync_progress ?? 0,
        totalItems: sync?.total_items ?? 0,
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
