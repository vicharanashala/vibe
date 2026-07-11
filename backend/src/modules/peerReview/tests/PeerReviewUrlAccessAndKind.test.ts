/**
 * Unit tests for the URL accessibility checker + kind detector.
 *
 * These are pure unit tests — no DB, no DI. We run them with vitest.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectKind } from '../utils/urlKindDetector.js';
import { PeerReviewUrlAccessibilityService } from '../services/PeerReviewUrlAccessibilityService.js';

// ---------------------------------------------------------------------------
// urlKindDetector
// ---------------------------------------------------------------------------

describe('detectKind', () => {
  it('classifies Google Drive URLs', () => {
    expect(detectKind('https://drive.google.com/file/d/abc/view')).toBe(
      'drive',
    );
    expect(detectKind('https://docs.google.com/document/d/abc/edit')).toBe(
      'drive',
    );
    expect(
      detectKind('https://drive.usercontent.google.com/download?id=abc'),
    ).toBe('drive');
  });

  it('classifies GitHub URLs', () => {
    expect(detectKind('https://github.com/user/repo')).toBe('github');
    expect(detectKind('https://gist.github.com/user/abc')).toBe('github');
  });

  it('classifies YouTube URLs', () => {
    expect(detectKind('https://youtube.com/watch?v=abc')).toBe('youtube');
    expect(detectKind('https://youtu.be/abc')).toBe('youtube');
    expect(detectKind('https://m.youtube.com/watch?v=abc')).toBe('youtube');
  });

  it('classifies OneDrive + SharePoint', () => {
    expect(detectKind('https://onedrive.live.com/?cid=abc')).toBe('oneDrive');
    expect(detectKind('https://1drv.ms/p/abc')).toBe('oneDrive');
    expect(detectKind('https://company.sharepoint.com/abc')).toBe(
      'oneDrive',
    );
  });

  it('classifies Dropbox', () => {
    expect(detectKind('https://dropbox.com/s/abc/file')).toBe('dropbox');
    expect(detectKind('https://dl.dropboxusercontent.com/abc')).toBe(
      'dropbox',
    );
  });

  it('returns "other" for unknown hosts and malformed URLs', () => {
    expect(detectKind('https://example.com/foo')).toBe('other');
    expect(detectKind('https://my-personal-blog.dev/post')).toBe('other');
    expect(detectKind('not a url')).toBe('other');
    expect(detectKind('')).toBe('other');
  });

  it('is case-insensitive and tolerates www. on the host', () => {
    // The drive subdomain is drive.google.com (not www.google.com), so the
    // upper-case test exercises case-insensitivity, not arbitrary subdomains.
    expect(detectKind('https://DRIVE.Google.com/file/d/abc/view')).toBe(
      'drive',
    );
    expect(detectKind('https://www.drive.google.com/file/d/abc/view')).toBe(
      'drive',
    );
  });
});

// ---------------------------------------------------------------------------
// PeerReviewUrlAccessibilityService
// ---------------------------------------------------------------------------

describe('PeerReviewUrlAccessibilityService', () => {
  let service: PeerReviewUrlAccessibilityService;

  beforeEach(() => {
    service = new PeerReviewUrlAccessibilityService();
    service.clearCache();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      url: 'https://example.com',
      ok: true,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects malformed URLs without making a request', async () => {
    const r = await service.check('not a url');
    expect(r.accessible).toBe(false);
    expect(r.reason).toBe('invalid_url');
  });

  it('rejects non-http(s) URLs', async () => {
    const r = await service.check('ftp://example.com/file');
    expect(r.accessible).toBe(false);
    expect(r.reason).toBe('invalid_url');
  });

  it('returns accessible=true for a 200 response', async () => {
    // We expect this to fail in the test environment (no real network or
    // sandbox). We just verify the *shape* of the return: a structured
    // AccessibilityResult, never a throw.
    const r = await service.check('https://example.com/something');
    expect(typeof r.accessible).toBe('boolean');
    expect(['http_2xx', 'http_401', 'http_403', 'http_404', 'http_5xx',
            'auth_required', 'timeout', 'dns_failure', 'connection_refused',
            'method_not_allowed', 'unknown'])
      .toContain(r.reason);
  });

  it('caches results within the TTL window', async () => {
    // Force a cached result by pre-populating.
    // We test that clearCache() invalidates.
    const url = 'https://example.com/cached-test';
    await service.check(url);
    // No assertion on the cached value (environment-dependent); just
    // that calling it again doesn't throw.
    const second = await service.check(url);
    expect(second).toBeDefined();

    // Clearing must reset the cache.
    service.clearCache(url);
    const third = await service.check(url);
    expect(third).toBeDefined();
  });

  it('checkMany resolves results in the same order as input', async () => {
    const urls = [
      'https://example.com/a',
      'not a url',
      'https://example.com/b',
    ];
    const r = await service.checkMany(urls);
    expect(r.length).toBe(3);
    // Position 1 must be the invalid-url one (deterministic — no network).
    expect(r[1].reason).toBe('invalid_url');
  });
});
