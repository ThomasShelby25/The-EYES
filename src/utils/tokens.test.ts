import { afterEach, describe, expect, it, vi } from 'vitest';

import { decryptToken, encryptToken } from '@/utils/tokens';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('token encryption', () => {
  it('encrypts and decrypts when TOKEN_ENCRYPTION_KEY is configured', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));

    const encrypted = encryptToken('token-123');

    expect(encrypted).not.toBe('token-123');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(decryptToken(encrypted)).toBe('token-123');
  });

  it('falls back to plaintext token handling in non-production when key is missing', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);

    expect(encryptToken('plain-token')).toBe('plain-token');
    expect(decryptToken('plain-token')).toBe('plain-token');
  });

  it('fails closed in production when key is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);

    expect(() => encryptToken('prod-token')).toThrowError(/TOKEN_ENCRYPTION_KEY is required/i);
    expect(() => decryptToken('enc:v1:iv:payload:tag')).toThrowError(/TOKEN_ENCRYPTION_KEY is required/i);
  });
});
