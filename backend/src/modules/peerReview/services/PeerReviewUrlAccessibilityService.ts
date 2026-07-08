import { injectable } from 'inversify';

/**
 * URL accessibility checker for peer-review submission links.
 *
 * Performs a single HTTP HEAD request (or GET fallback for servers that
 * refuse HEAD) per URL with a 5-second timeout. Detects the common
 * Drive / OneDrive "private link" behavior where Drive 302-redirects to
 * accounts.google.com — we treat that as not publicly accessible.
 *
 * Results are cached in-memory for 60s per (url) to avoid hammering
 * upstream hosts during the 1..N link accessibility check inside a
 * single submit() call.
 *
 * Designed to be cheap and pure-ish:
 *   - check() returns a structured result; never throws on a remote
 *     failure (returns `{accessible:false, reason:...}` instead).
 *   - on real exceptions (DNS, fetch crash) we also return a failure
 *     result with a reason code, so the caller's Promise.all() never
 *     rejects.
 */

export interface AccessibilityResult {
  accessible: boolean;
  reason?:
    | 'http_2xx'
    | 'http_401'
    | 'http_403'
    | 'http_404'
    | 'http_5xx'
    | 'auth_required'
    | 'timeout'
    | 'dns_failure'
    | 'connection_refused'
    | 'invalid_url'
    | 'method_not_allowed'
    | 'unknown';
  finalUrl?: string;
  status?: number;
}

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

interface CacheEntry {
  expiresAt: number;
  result: AccessibilityResult;
}

@injectable()
export class PeerReviewUrlAccessibilityService {
  private cache = new Map<string, CacheEntry>();

  /**
   * Clear the in-memory cache. Useful for tests and for ops endpoints
   * that need to force a re-check after a link was unshared.
   */
  clearCache(url?: string): void {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if a URL is publicly accessible. Never throws.
   */
  async check(url: string): Promise<AccessibilityResult> {
    // Validate URL shape first — avoids spamming the cache with garbage.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { accessible: false, reason: 'invalid_url' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { accessible: false, reason: 'invalid_url' };
    }

    // Cache hit?
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this._checkOnce(url);
    this.cache.set(url, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    });
    return result;
  }

  /**
   * Check multiple URLs in parallel. Resolves to an array of results in
   * the same order as the input.
   */
  async checkMany(urls: string[]): Promise<AccessibilityResult[]> {
    return Promise.all(urls.map(u => this.check(u)));
  }

  // ---- private ----

  private async _checkOnce(url: string): Promise<AccessibilityResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      // Some servers (e.g. older cloudfront configs) reject HEAD with 405.
      // We try HEAD first; on 405 we fall back to GET. The body isn't
      // consumed (we never read it), so GET is essentially free.
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
          });
        }
      } catch (e: any) {
        return classifyFetchError(e);
      }

      const finalUrl = res.url || url;
      const status = res.status;
      const reason = classifyStatus(status, finalUrl);
      return {
        accessible: reason === 'http_2xx',
        reason,
        finalUrl,
        status,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function classifyStatus(
  status: number,
  finalUrl: string,
): AccessibilityResult['reason'] {
  if (status >= 200 && status < 300) {
    // Drive & OneDrive sometimes return 2xx with a redirect to a login
    // page; the safest cross-provider check is to also sniff the final URL
    // host for known auth walls.
    try {
      const host = new URL(finalUrl).hostname.toLowerCase();
      if (
        host.includes('accounts.google.com') ||
        host.includes('login.microsoftonline.com') ||
        host.includes('login.live.com')
      ) {
        return 'auth_required';
      }
    } catch {
      // ignore URL parse errors here; the status is the source of truth
    }
    return 'http_2xx';
  }
  if (status === 401) return 'http_401';
  if (status === 403) return 'http_403';
  if (status === 404) return 'http_404';
  if (status >= 500 && status < 600) return 'http_5xx';
  // 4xx fallback (405 etc. should never reach here because we re-issue as GET,
  // but be defensive).
  return 'unknown';
}

function classifyFetchError(e: any): AccessibilityResult {
  if (!e) return { accessible: false, reason: 'unknown' };
  const name = String(e?.name ?? '');
  const message = String(e?.message ?? '');
  if (name === 'AbortError' || /abort/i.test(message)) {
    return { accessible: false, reason: 'timeout' };
  }
  if (/ENOTFOUND/i.test(message) || /getaddrinfo/i.test(message)) {
    return { accessible: false, reason: 'dns_failure' };
  }
  if (/ECONNREFUSED/i.test(message)) {
    return { accessible: false, reason: 'connection_refused' };
  }
  return { accessible: false, reason: 'unknown' };
}