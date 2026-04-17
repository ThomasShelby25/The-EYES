import { describe, expect, it } from 'vitest';

import { scoreGmailEvent, scoreGithubEvent, scoreRedditEvent } from '@/utils/risk/scorer';

describe('risk scorer', () => {
  it('scores sensitive Gmail content as flagged', () => {
    const result = scoreGmailEvent({
      subject: 'Please rotate API key',
      snippet: 'The password and token are in this thread',
      from: 'security@corp.com',
    });

    expect(result.flagged).toBe(true);
    expect(result.severity === 'MEDIUM' || result.severity === 'HIGH').toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(45);
  });

  it('scores high-visibility GitHub repo as flagged', () => {
    const result = scoreGithubEvent({
      title: 'org/public-repo',
      description: 'production deployment scripts',
      stars: 700,
      forks: 120,
      language: 'Shell',
    });

    expect(result.flagged).toBe(true);
    expect(result.severity).toBe('HIGH');
  });

  it('scores benign Reddit comment as low risk', () => {
    const result = scoreRedditEvent({
      body: 'Had a great day building features.',
      subreddit: 'programming',
      score: 3,
    });

    expect(result.flagged).toBe(false);
    expect(result.severity).toBe('LOW');
    expect(result.score).toBeLessThan(45);
  });
});
