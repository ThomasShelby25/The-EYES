import { afterEach, describe, expect, it, vi } from 'vitest';

import { revokeProviderAccess } from '@/utils/provider-revocation';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('provider revocation helper', () => {
  it('revokes Google token successfully', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));

    const result = await revokeProviderAccess({
      platform: 'gmail',
      encryptedAccessToken: 'access-token',
      encryptedRefreshToken: 'refresh-token',
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.provider).toBe('google');
    expect(result.status).toBe('success');
    expect(result.attempted).toBe(true);
  });

  it('skips GitHub revocation when app credentials are missing', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', undefined);
    vi.stubEnv('GITHUB_CLIENT_SECRET', undefined);

    const result = await revokeProviderAccess({
      platform: 'github',
      encryptedAccessToken: 'access-token',
    });

    expect(result.provider).toBe('github');
    expect(result.status).toBe('skipped');
    expect(result.message.toLowerCase()).toContain('credentials');
  });

  it('returns failed status when provider revoke endpoint errors', async () => {
    vi.stubEnv('NOTION_CLIENT_ID', 'notion-client-id');
    vi.stubEnv('NOTION_CLIENT_SECRET', 'notion-client-secret');

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 })
    );

    const result = await revokeProviderAccess({
      platform: 'notion',
      encryptedAccessToken: 'notion-access-token',
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.provider).toBe('notion');
    expect(result.status).toBe('failed');
    expect(result.httpStatus).toBe(401);
  });
});