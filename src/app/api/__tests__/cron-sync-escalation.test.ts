import { describe, expect, it } from 'vitest';

import { shouldDispatchEscalation, toEscalationCandidates } from '@/app/api/cron/sync/route';

describe('cron escalation policy helpers', () => {
  it('produces warning escalations for retry pressure', () => {
    const candidates = toEscalationCandidates({
      pendingRetries: 12,
      maxRetryAttempt: 4,
      deadLetters24h: 0,
      runs24h: 4,
      failures24h: 0,
      failureRate24h: 0,
    });

    expect(candidates.some((candidate) => candidate.code === 'retry_queue_backlog')).toBe(true);
    expect(candidates.some((candidate) => candidate.code === 'high_retry_attempts')).toBe(true);
  });

  it('produces critical escalations for dead-letter volume and failure-rate spikes', () => {
    const candidates = toEscalationCandidates({
      pendingRetries: 0,
      maxRetryAttempt: 0,
      deadLetters24h: 5,
      runs24h: 8,
      failures24h: 3,
      failureRate24h: 0.375,
    });

    expect(candidates.some((candidate) => candidate.code === 'dead_letter_volume')).toBe(true);
    expect(candidates.some((candidate) => candidate.code === 'scheduler_failure_rate')).toBe(true);
    expect(candidates.every((candidate) => ['warning', 'critical'].includes(candidate.severity))).toBe(true);
  });

  it('enforces cooldown before redispatching escalation notifications', () => {
    const nowMs = Date.UTC(2026, 3, 8, 12, 0, 0);

    expect(
      shouldDispatchEscalation({
        lastDispatchedAt: null,
        nowMs,
        cooldownMinutes: 60,
      })
    ).toBe(true);

    expect(
      shouldDispatchEscalation({
        lastDispatchedAt: new Date(nowMs - 30 * 60 * 1000).toISOString(),
        nowMs,
        cooldownMinutes: 60,
      })
    ).toBe(false);

    expect(
      shouldDispatchEscalation({
        lastDispatchedAt: new Date(nowMs - 61 * 60 * 1000).toISOString(),
        nowMs,
        cooldownMinutes: 60,
      })
    ).toBe(true);
  });
});
