import type { Transition, Variants } from 'motion/react';

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
