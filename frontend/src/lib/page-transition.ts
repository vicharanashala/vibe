/**
 * Hands the rect of a just-clicked "Continue" button across the route change
 * to /student/learn, so the course page can animate expanding out of it
 * instead of just appearing. A plain module-level value (not a store) is
 * enough — it's write-once/read-once within the same tab, consumed on the
 * destination page's first render and immediately cleared so a refresh or a
 * direct visit to the URL never replays the animation.
 */
export type LaunchOrigin = { top: number; left: number; width: number; height: number };

let pendingLaunchOrigin: LaunchOrigin | null = null;

export function setLaunchOrigin(rect: DOMRect) {
  pendingLaunchOrigin = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function consumeLaunchOrigin(): LaunchOrigin | null {
  const origin = pendingLaunchOrigin;
  pendingLaunchOrigin = null;
  return origin;
}
