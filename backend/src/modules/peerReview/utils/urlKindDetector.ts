/**
 * URL kind detector for peer-review submission links.
 *
 * Pure function — no I/O. Used by both the server (to coerce the kind
 * field when missing in the request) and the client (to pre-select the
 * kind chip before submitting).
 *
 * Detection rules:
 *   - drive.google.com / docs.google.com / drive.usercontent.google.com → drive
 *   - github.com / gist.github.com                                  → github
 *   - youtube.com / youtu.be / m.youtube.com                         → youtube
 *   - onedrive.live.com / 1drv.ms / sharepoint.com                   → oneDrive
 *   - dropbox.com / dropboxusercontent.com / dl.dropboxusercontent.com → dropbox
 *   - everything else                                               → other
 *
 * Host comparison is case-insensitive and tolerates leading "www.".
 */

const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'drive', re: /^(www\.)?(drive|docs)\.google\.com$/i },
  { kind: 'drive', re: /^(www\.)?drive\.usercontent\.google\.com$/i },
  { kind: 'github', re: /^(www\.)?github\.com$/i },
  { kind: 'github', re: /^(www\.)?gist\.github\.com$/i },
  { kind: 'youtube', re: /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i },
  { kind: 'oneDrive', re: /^(www\.)?onedrive\.live\.com$/i },
  { kind: 'oneDrive', re: /^(www\.)?1drv\.ms$/i },
  { kind: 'oneDrive', re: /^(www\.)?(.+\.)?sharepoint\.com$/i },
  { kind: 'oneDrive', re: /^(www\.)?(.+\.)?office\.com$/i },
  { kind: 'dropbox', re: /^(www\.)?dropbox\.com$/i },
  { kind: 'dropbox', re: /^(www\.)?(dl\.)?dropboxusercontent\.com$/i },
];

export type DetectedUrlKind =
  | 'drive'
  | 'github'
  | 'youtube'
  | 'oneDrive'
  | 'dropbox'
  | 'other';

/**
 * Returns the kind for a URL string, or 'other' if the host doesn't match
 * any known provider. Safe to call with a malformed URL (returns 'other').
 */
export function detectKind(url: string): DetectedUrlKind {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    for (const p of PATTERNS) {
      if (p.re.test(host)) return p.kind as DetectedUrlKind;
    }
    return 'other';
  } catch {
    return 'other';
  }
}