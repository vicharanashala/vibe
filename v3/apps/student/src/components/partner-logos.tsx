import { cn } from '@/lib/utils';

export const PARTNERS = [
  { name: 'IIT Ropar', src: '/partners/iit-ropar.png', className: 'h-12 sm:h-14' },
  { name: 'annam.ai', src: '/partners/annam-ai.png', className: 'h-6 sm:h-7' },
  { name: 'Vicharanashala Lab for Education Design', src: '/partners/vicharanashala.png', className: 'h-9 sm:h-10' },
] as const;

/**
 * IIT Ropar, annam.ai and Vicharanashala. The artwork has light backgrounds,
 * so it always sits on a white plate — that keeps it legible in dark mode.
 */
export function PartnerLogos({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <ul
      aria-label="Partners"
      className={cn(
        'mx-auto flex w-fit max-w-full flex-wrap items-center justify-center rounded-2xl bg-white ring-1 ring-black/5',
        size === 'sm' ? 'gap-x-6 gap-y-3 px-5 py-3' : 'gap-x-10 gap-y-5 px-6 py-5 sm:px-10',
        className,
      )}
    >
      {PARTNERS.map((p) => (
        <li key={p.name}>
          <img
            src={p.src}
            alt={p.name}
            loading="lazy"
            className={cn('w-auto object-contain', size === 'sm' ? 'max-h-9 scale-90' : p.className)}
          />
        </li>
      ))}
    </ul>
  );
}
