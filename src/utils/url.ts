import { headers } from 'next/headers';

/**
 * Resolves the appropriate base URL for the current environment.
 * Prioritizes the Host header if available (useful for local development with NEXT_PUBLIC_SITE_URL set to prod).
 */
export async function getBaseUrl(request?: Request) {
  // 1. Try to get host from request object if provided
  if (request) {
    const host = request.headers.get('host');
    if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }
  }

  // 2. Try to get host from next/headers
  try {
    const headerList = await headers();
    const host = headerList.get('host');
    if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }
  } catch {
    // Not in a request scope
  }

  // 3. Fallback to env var
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // 4. Final total fallback
  return 'http://localhost:3000';
}
