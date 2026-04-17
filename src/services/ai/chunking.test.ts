import { describe, expect, it } from 'vitest';

import { buildDeterministicChunks } from '@/services/ai/chunking';

describe('buildDeterministicChunks', () => {
  it('produces deterministic bounded chunks with source preface', () => {
    const content = Array.from(
      { length: 80 },
      (_, index) => `Sentence ${index + 1} covers reliability planning and execution.`
    ).join(' ');

    const input = {
      platform: 'gmail',
      eventType: 'email',
      title: 'Weekly Ops Digest',
      content,
    };

    const first = buildDeterministicChunks(input);
    const second = buildDeterministicChunks(input);

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(1);
    expect(first.length).toBeLessThanOrEqual(5);

    first.forEach((chunk) => {
      expect(chunk.startsWith('[Source: gmail] [Type: email] Title: Weekly Ops Digest\n\n')).toBe(true);
    });
  });

  it('returns a single fallback chunk when content is empty', () => {
    const chunks = buildDeterministicChunks({
      platform: 'notion',
      eventType: null,
      title: null,
      content: '    ',
    });
    expect(chunks).toEqual(['[Source: notion] [Type: null] Title: null\n\n']);
  });
});
