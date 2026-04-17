import { describe, expect, it } from 'vitest';

import { computeBackoffDelayMs, isRetryableGoogleRefreshFailure } from '@/utils/oauth';

describe('oauth refresh retry helpers', () => {
  it('computes bounded exponential backoff delays with jitter', () => {
    expect(computeBackoffDelayMs(1, 0)).toBe(320);
    expect(computeBackoffDelayMs(1, 0.5)).toBe(400);
    expect(computeBackoffDelayMs(2, 1)).toBe(960);
    expect(computeBackoffDelayMs(10, 0)).toBe(4000);
    expect(computeBackoffDelayMs(10, 1)).toBe(5000);
  });

  it('retries transient provider failures and skips known terminal auth failures', () => {
    expect(isRetryableGoogleRefreshFailure(null, null)).toBe(true);
    expect(isRetryableGoogleRefreshFailure(500, null)).toBe(true);
    expect(isRetryableGoogleRefreshFailure(429, null)).toBe(true);
    expect(isRetryableGoogleRefreshFailure(400, { error: 'invalid_grant' })).toBe(false);
    expect(isRetryableGoogleRefreshFailure(401, { error_description: 'invalid_client' })).toBe(false);
    expect(isRetryableGoogleRefreshFailure(403, { error: 'forbidden' })).toBe(false);
  });
});
