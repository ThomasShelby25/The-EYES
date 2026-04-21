import { NextResponse } from 'next/server';

import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { getValidGithubToken } from '@/utils/oauth';
import { scoreGithubEvent } from '@/utils/risk/scorer';
import { resolveSyncActor } from '@/utils/sync/actor';

type GitHubRepo = {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  updated_at: string;
};

function formatDate(input: string | null) {
  if (!input) return new Date().toISOString();
  return new Date(input).toISOString();
}

export async function POST(request: Request) {
  try {
    const actor = await resolveSyncActor(request);
    if ('status' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }

    const { supabase, userId, userEmail, userName } = actor;

    const accessToken = await getValidGithubToken(supabase, userId);

    if (!accessToken) {
      return NextResponse.json({ error: 'GitHub is not connected yet.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const perPage = 100;
    const maxTotal = depth === 'deep' ? 300 : 20;

    let allRepos: GitHubRepo[] = [];
    let page = 1;

    // --- PAGINATION LOOP ---
    while (allRepos.length < maxTotal) {
      const repoResponse = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      });

      if (!repoResponse.ok) break;

      const repos = (await repoResponse.json()) as GitHubRepo[];
      if (!repos || repos.length === 0) break;

      allRepos = [...allRepos, ...repos];
      page += 1;
      if (repos.length < perPage) break;
    }

    const now = new Date().toISOString();

    const rawEvents = allRepos.map((repo) => {
      const description = repo.description || 'No description provided.';
      const content = [
        description,
        `Language: ${repo.language || 'Unknown'}`,
        `Stars: ${repo.stargazers_count} | Forks: ${repo.forks_count}`,
        `Repo: ${repo.html_url}`,
      ].join(' ');

      const risk = scoreGithubEvent({
        title: repo.full_name,
        description,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
      });

      return {
        user_id: userId,
        platform: 'github',
        platform_id: String(repo.id),
        event_type: 'repository',
        title: repo.full_name,
        content,
        author: userEmail || userName || 'GitHub',
        timestamp: formatDate(repo.updated_at || repo.pushed_at),
        metadata: {
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          pushed_at: repo.pushed_at,
          updated_at: repo.updated_at,
          risk_score: risk.score,
          risk_factors: risk.reasons,
        },
        is_flagged: risk.flagged,
        flag_severity: risk.severity,
        flag_reason: risk.reasons[0] || null,
      };
    });

    await upsertRawEventsSafely(supabase, rawEvents);

    const { count: totalMemories, error: countError } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw countError;
    }

    const [, profileUpdate] = await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'github',
        status: 'connected',
        sync_progress: 100,
        total_items: rawEvents.length,
        last_sync_at: now,
        next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        error_message: null,
      }),
      supabase.from('user_profiles').update({
        memories_indexed: totalMemories ?? rawEvents.length,
        updated_at: now,
      }).eq('user_id', userId),
    ]);

    if (profileUpdate.error) {
      throw profileUpdate.error;
    }

    return NextResponse.json({
      ok: true,
      syncedRepos: rawEvents.length,
      totalMemories: totalMemories ?? rawEvents.length,
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('github sync error:', error);
    return NextResponse.json(
      { error: 'Unable to sync GitHub data.', detail },
      { status: 500 }
    );
  }
}
