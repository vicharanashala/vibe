import type { Transition, Variants } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * Shared micro-interaction presets: short, subtle and consistent. Every use
 * should go through `useReducedMotion()` (or `MotionConfig reducedMotion="user"`)
 * so students who ask their OS for less motion get none of the movement.
 */

/** A soft spring for small things settling into place (icons, badges). */
export const softSpring: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };

/** Easing for fades and slides: quick out, gentle landing. */
export const easeOut: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

/** A list row arriving: rises a few pixels and fades in. */
export const rowIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: easeOut },
};

/** A status icon changing: pops from slightly small, with a little overshoot. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  shown: { opacity: 1, scale: 1, transition: softSpring },
};

/** The same presets with movement removed, for reduced motion. */
export const still: Variants = { hidden: { opacity: 1 }, shown: { opacity: 1 } };

/**
 * CSS-only entrance for list items and cards (tw-animate-css): fades in and
 * rises 4px. Pair with `stagger(index)` so a list cascades in on first load.
 */
export const enterClass = 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300';

/** Delay for the nth item of a cascading list, capped so long lists don't drag. */
export function stagger(index: number): { animationDelay: string; animationFillMode: 'both' } {
  return { animationDelay: `${Math.min(index, 8) * 35}ms`, animationFillMode: 'both' };
}

/** A gentle lift on hover for clickable cards. */
export const liftClass = 'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md';

/**
 * Replays a short fade-and-rise on an element whenever `key` changes (e.g. the
 * route path), without remounting what's inside it, so pages keep their state.
 * Skipped for reduced motion and where the Web Animations API is missing.
 */
export function useEnterOnChange<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [key]);
  return ref;
}
