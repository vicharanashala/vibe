import Avatar from 'boring-avatars';

import { Avatar as UiAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * Deterministic, generative placeholders (boring-avatars) for anything that has
 * no real logo or image. The same seed always draws the same picture, so a
 * course or person is recognisable everywhere it appears.
 *
 * Palette: the "sunny" theme's warm gradient stops plus a light cream.
 */
export const SUNNY_PALETTE = ['#9C3A21', '#C76829', '#DC8E43', '#E9B88A', '#F7E7D3'];

const MINOR_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'to', 'for', 'with']);

export function initialsOf(name: string) {
  return name
    .replace(/^sample:\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !MINOR_WORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Generative cover for a course: marble art seeded by the course id, with its initials. */
export function GeneratedCover({ seed, title, className, compact }: { seed: string; title: string; className?: string; compact?: boolean }) {
  const letters = initialsOf(title);
  return (
    <div aria-hidden className={cn('relative isolate overflow-hidden rounded-xl bg-muted', className)}>
      <Avatar
        name={seed}
        variant="marble"
        colors={SUNNY_PALETTE}
        square
        size="100%"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      />
      {letters && (
        <span
          className={cn(
            'absolute inset-0 grid place-items-center font-aleo font-semibold text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.25)]',
            compact ? 'text-sm' : 'text-3xl',
          )}
        >
          {letters}
        </span>
      )}
    </div>
  );
}

/**
 * Person avatar on shadcn Avatar: their photo when `src` is set, otherwise a
 * friendly generated "beam" face seeded by their account id (also the fallback
 * if the photo fails to load).
 */
export function GeneratedAvatar({
  seed,
  label,
  size = 36,
  src,
  className,
}: {
  seed: string;
  label?: string;
  size?: number;
  src?: string | null;
  className?: string;
}) {
  return (
    <UiAvatar
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
      aria-label={label}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
    >
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-transparent">
        <Avatar name={seed} variant="beam" colors={SUNNY_PALETTE} size={size} title={false} aria-hidden className="size-full" />
      </AvatarFallback>
    </UiAvatar>
  );
}
