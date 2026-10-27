/**
 * BadgeGrid — renders the 12 court-rank badges as a 3-column grid.
 *
 * Earned badges are full colour. Locked badges are greyed out but
 * show a small progress bar. Clicking (or pressing Enter/Space) on
 * any badge opens a popover anchored to the card, showing the
 * criteria text + progress detail. Clicking outside the popover,
 * pressing Escape, or clicking the card again closes it.
 *
 * Why a popover instead of an in-place flip: the panel is 480px
 * wide with 4 columns — each cell is ~88px. A flip card there
 * compresses criteria text into 60-70px columns which always
 * feels cramped. The popover breaks out of the grid and uses the
 * full panel width, giving the criteria 2-3 comfortable lines.
 *
 * Uses the badge catalogue from `BADGE_CATALOGUE` to fill in any
 * missing IDs in the response, so the grid always shows all 12.
 */

import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/utils';
import {
  getBadgesByTier,
} from '@/lib/motivation-api';
import {
  Badge,
  BadgeProgress,
  BadgeTier,
} from '@/types/motivation.types';

export interface BadgeGridProps {
  /** Progress per badge, returned by the API. */
  badges: BadgeProgress[];
  isLoading?: boolean;
}

export function BadgeGrid({
  badges,
  isLoading = false,
}: BadgeGridProps): React.JSX.Element {
  // Build a lookup so we can merge API progress with the catalogue.
  const progressById = new Map<string, BadgeProgress>();
  for (const p of badges) progressById.set(p.badge.id, p);

  // Flat list of all badges for lookup-by-id.
  const allBadges = Object.values(getBadgesByTier()).flat();

  // Popover state lives at the grid root so we can position the
  // popover relative to the active card's DOM rect.
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Escape closes the popover. (MotivationPanel also listens for
  // Escape to close the panel itself — closing the popover first
  // gives the user a chance to read it before the panel closes.)
  useEffect(() => {
    if (!activeBadgeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setActiveBadgeId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeBadgeId]);

  // Resize/scroll updates the popover position so it stays anchored
  // to the card. (Without this the popover would float in place after
  // the user scrolls the panel.)
  useEffect(() => {
    if (!activeBadgeId) return;
    const update = () => {
      const el = cardRefs.current.get(activeBadgeId);
      if (el) setAnchorRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [activeBadgeId]);

  const handleCardClick = (badgeId: string) => {
    if (activeBadgeId === badgeId) {
      setActiveBadgeId(null);
      return;
    }
    const el = cardRefs.current.get(badgeId);
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setActiveBadgeId(badgeId);
  };

  const activeBadge = activeBadgeId
    ? allBadges.find((b) => b.id === activeBadgeId) ?? null
    : null;
  const activeProgress = activeBadgeId
    ? progressById.get(activeBadgeId)
    : undefined;

  if (isLoading) {
    return <BadgeGridSkeleton />;
  }

  const tiers = getBadgesByTier();

  return (
    <section aria-label="Badges" className="relative">
      <div className="space-y-4">
        {(['entry', 'apprentice', 'courtier', 'royalty'] as const).map(
          (tier) => {
            const tierBadges = tiers[tier];
            if (tierBadges.length === 0) return null;
            return (
              <div key={tier}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {TIER_LABEL[tier]}
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {tierBadges.map((badge) => {
                    const progress = progressById.get(badge.id);
                    const isActive = activeBadgeId === badge.id;
                    return (
                      <BadgeCard
                        key={badge.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(badge.id, el);
                          else cardRefs.current.delete(badge.id);
                        }}
                        badge={badge}
                        progress={progress}
                        isActive={isActive}
                        onActivate={() => handleCardClick(badge.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* Click-outside overlay + popover. The overlay sits behind the
          popover (z-40) but above the grid. When no badge is active,
          nothing is rendered so the grid is fully interactive. */}
      {activeBadgeId && anchorRect && (
        <>
          <button
            type="button"
            aria-label="Close criteria popover"
            onClick={() => setActiveBadgeId(null)}
            className="fixed inset-0 z-40 bg-transparent cursor-default"
          />
          <BadgeCriteriaPopover
            badge={activeBadge}
            progress={activeProgress}
            anchorRect={anchorRect}
            onClose={() => setActiveBadgeId(null)}
          />
        </>
      )}
    </section>
  );
}

// ── Tier label ─────────────────────────────────────────────────────────────

const TIER_LABEL: Record<BadgeTier, string> = {
  entry: 'Tier 1 — Entry',
  apprentice: 'Tier 2 — Apprentice',
  courtier: 'Tier 3 — Courtier',
  royalty: 'Tier 4 — Royalty',
};

// ── Single badge card ──────────────────────────────────────────────────────

interface BadgeCardProps {
  badge: Badge;
  /** If undefined, treat as locked with 0/0 progress. */
  progress?: BadgeProgress;
  isActive: boolean;
  onActivate: () => void;
}

const BadgeCard = forwardRef<HTMLDivElement, BadgeCardProps>(function BadgeCard(
  { badge, progress, isActive, onActivate },
  ref,
) {
  const earned = progress?.earned ?? false;
  const current = progress?.progress.current ?? 0;
  const target = progress?.progress.target ?? 0;
  const pct =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'relative h-[88px] w-full cursor-pointer',
        'rounded-lg border text-center',
        'flex flex-col items-center justify-center',
        'p-2 transition-all duration-200',
        earned
          ? 'border-amber-300 bg-gradient-to-br from-[#FFD700]/10 to-[#FFA500]/10'
          : 'border-border bg-muted/30 grayscale opacity-70 hover:opacity-90 hover:grayscale-[0.5]',
        // Active state — ring + shadow so the user sees which card
        // the popover is anchored to.
        isActive && 'ring-2 ring-amber-400 ring-offset-1 shadow-md',
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      aria-haspopup="dialog"
      aria-label={`${badge.name} — ${earned ? 'earned' : 'locked'}. Activate to see criteria.`}
      onClick={onActivate}
      onKeyDown={onKeyDown}
    >
      <span className="text-3xl mb-1" aria-hidden="true">
        {badge.emoji}
      </span>
      <span
        className={cn(
          'text-xs font-medium',
          earned ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {badge.name}
      </span>
      {!earned && target > 0 && (
        <div
          className="h-1 bg-muted rounded-full overflow-hidden w-full mt-2"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`${badge.name} progress`}
        >
          <div
            className="h-full bg-[#FFA500] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
});

// ── Criteria popover ───────────────────────────────────────────────────────

interface BadgeCriteriaPopoverProps {
  badge: Badge | null;
  progress?: BadgeProgress;
  anchorRect: DOMRect;
  onClose: () => void;
}

function BadgeCriteriaPopover({
  badge,
  progress,
  anchorRect,
  onClose,
}: BadgeCriteriaPopoverProps): React.JSX.Element | null {
  if (!badge) return null;

  const earned = progress?.earned ?? false;
  const current = progress?.progress.current ?? 0;
  const target = progress?.progress.target ?? 0;
  const unit = progress?.progress.unit ?? '';
  const pct =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  // Position the popover centred horizontally below the anchor, with
  // a 8px gap. If it would overflow the bottom of the viewport, flip
  // to above. Clamp to viewport edges so it never gets cut off.
  const POPOVER_WIDTH = 360;
  const POPOVER_MAX_HEIGHT = 280;
  const GAP = 8;
  const margin = 12; // viewport edge padding
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
  left = Math.max(margin, Math.min(left, vw - POPOVER_WIDTH - margin));

  const placeBelow = anchorRect.bottom + GAP + POPOVER_MAX_HEIGHT < vh;
  const top = placeBelow
    ? anchorRect.bottom + GAP
    : Math.max(margin, anchorRect.top - GAP - POPOVER_MAX_HEIGHT);

  return (
    <div
      role="dialog"
      aria-label={`${badge.name} criteria`}
      className={cn(
        'fixed z-50',
        'w-[360px] rounded-xl border border-amber-200',
        'bg-white text-gray-800 shadow-xl',
        'p-4',
        // Soft entrance — fade + slight scale. `motion-reduce` skips
        // the animation for users who prefer reduced motion.
        'animate-in fade-in zoom-in-95 duration-150',
        'motion-reduce:animate-none',
      )}
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      {/* Header — emoji + tier label + name */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full text-3xl"
          style={{
            width: 56,
            height: 56,
            backgroundColor: '#FFF8DC',
            border: '2px solid #FFD700',
            lineHeight: '56px',
          }}
          aria-hidden="true"
        >
          {badge.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">
            {TIER_LABEL[badge.tier]}
          </p>
          <h3 className="text-base font-semibold text-amber-900 leading-tight">
            {badge.name}
          </h3>
          {badge.sanskrit && (
            <p className="text-xs italic text-amber-700/80">{badge.sanskrit}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 flex-shrink-0 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          ✕
        </button>
      </div>

      {/* Criteria */}
      <div className="border-t border-amber-100 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
          {earned ? 'Earned' : 'How to earn'}
        </p>
        <p className="text-sm leading-relaxed text-gray-700">
          {badge.criteria}
        </p>
      </div>

      {/* Progress / earned footer */}
      <div className="mt-3 pt-3 border-t border-amber-100">
        {earned ? (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Earned{' '}
              {progress?.earnedAt
                ? progress.earnedAt.toLocaleDateString()
                : ''}
            </span>
            <span className="text-amber-700/80">Verified by ViBe</span>
          </div>
        ) : target > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-500">
                {current} / {target} {unit}
              </span>
            </div>
            <div
              className="h-1.5 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={current}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-label={`${badge.name} progress`}
            >
              <div
                className="h-full bg-[#FFA500] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Hint footer */}
      <p className="mt-3 text-[10px] text-gray-400 text-center">
        Click outside or press Esc to close
      </p>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function BadgeGridSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Badges" aria-busy="true">
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] rounded-lg border border-border bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
