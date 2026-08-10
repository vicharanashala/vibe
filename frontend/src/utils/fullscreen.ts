// Native (F11-style) fullscreen helpers for the focused learn experience.
//
// The Fullscreen API only grants a request that runs inside a user gesture's
// "transient activation" window, which an `await` can consume/expire. So callers
// should invoke `enterFullscreen()` synchronously in the click handler — before
// any await — and back it out with `exitFullscreen()` if the action is aborted.
//
// We fullscreen the document root (not a specific element) so that overlays
// rendered elsewhere in the tree — e.g. the learn page's proctoring UI — stay
// painted; native fullscreen only renders the target element's subtree.

export function enterFullscreen(): void {
  try {
    if (document.fullscreenElement) return;
    // Swallow rejections (browser policy / user denial): the app stays usable,
    // just not fullscreen.
    document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    /* requestFullscreen unsupported — no-op */
  }
}

export function exitFullscreen(): void {
  try {
    if (!document.fullscreenElement) return;
    document.exitFullscreen?.().catch(() => {});
  } catch {
    /* exitFullscreen unsupported — no-op */
  }
}
