/**
 * ExportButtons — PDF / JPEG export and social share for earned badges.
 *
 * v1 ships with zero new dependencies:
 *   - PDF: window.print() + a hidden printable div with @media print
 *     styles. The browser's "Save as PDF" affordance handles the rest.
 *   - JPEG: hand-rolled <canvas>, drawn via 2D context.
 *   - Share: navigator.share() with download fallback.
 *
 * v1.1 will swap the JPEG path for html2canvas + jspdf when SVG
 * badge art replaces the emoji.
 *
 * Visual style (FLEX-on-LinkedIn):
 *   - PDF + JPEG both render a gold-gradient badge with the ViBe logo +
 *     "ViBe" wordmark in the bottom-right corner so each export carries
 *     the platform's brand. The logo is loaded asynchronously from
 *     /img/vibe_logo_img.ico via the browser's native image decoder
 *     (works in Chrome / Firefox / Safari without extra deps).
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';
import { BadgeProgress } from '@/types/motivation.types';

// Brand asset — kept in one place so a future re-brand only touches this line.
const VIBE_LOGO_SRC = '/img/vibe_logo_img.ico';
const VIBE_WORDMARK = 'ViBe';

// Async load the ViBe logo once. Resolves to an HTMLImageElement on
// success, null on failure (drawers fall back to text-only branding).
let _logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadVibeLogo(): Promise<HTMLImageElement | null> {
  if (_logoPromise) return _logoPromise;
  _logoPromise = new Promise((resolve) => {
    const img = new Image();
    // .ico files are natively decoded by all evergreen browsers.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('ViBe logo failed to load — exports will fall back to text-only branding.');
      resolve(null);
    };
    img.src = VIBE_LOGO_SRC;
  });
  return _logoPromise;
}

export interface ExportButtonsProps {
  badges: BadgeProgress[];
}

export function ExportButtons({
  badges,
}: ExportButtonsProps): React.JSX.Element {
  const earned = badges.filter((b) => b.earned);
  const [selected, setSelected] = useState<BadgeProgress | null>(
    earned[0] ?? null,
  );

  if (earned.length === 0) {
    return (
      <section aria-label="Export" className="text-sm text-muted-foreground">
        Earn a badge to enable export.
      </section>
    );
  }

  return (
    <section aria-label="Export" className="space-y-3">
      <h3 className="text-base font-semibold">Export & share</h3>
      {/* Selector for which badge to export */}
      <div className="flex flex-wrap gap-1">
        {earned.map((b) => (
          <button
            key={b.badge.id}
            type="button"
            onClick={() => setSelected(b)}
            className={cn(
              'px-2 py-1 rounded-md text-xs border',
              selected?.badge.id === b.badge.id
                ? 'border-[#FFA500] bg-[#FFD700]/10'
                : 'border-border hover:bg-muted',
            )}
            aria-pressed={selected?.badge.id === b.badge.id}
          >
            {b.badge.emoji} {b.badge.name}
          </button>
        ))}
      </div>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => selected && handleExportPdf(selected)}
          disabled={!selected}
        >
          Export PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => selected && handleExportJpeg(selected)}
          disabled={!selected}
        >
          Export JPEG
        </Button>
        <Button
          type="button"
          onClick={() => selected && handleShare(selected)}
          disabled={!selected}
        >
          Share
        </Button>
      </div>
      {/* Hidden printable area — only visible during window.print().
          Portaled to document.body so it escapes the @media print rule
          that hides <body> > * (the React root <div id="root">). Without
          the portal, the printable area would inherit display: none from
          its ancestor and render blank in the PDF. */}
      {selected &&
        typeof document !== 'undefined' &&
        createPortal(<PrintableBadgeArea badge={selected} />, document.body)}
    </section>
  );
}

// ── Hidden printable area ──────────────────────────────────────────────────

interface PrintableBadgeAreaProps {
  badge: BadgeProgress;
}

function PrintableBadgeArea({
  badge,
}: PrintableBadgeAreaProps): React.JSX.Element {
  return (
    <div
      id="motivation-print-area"
      // Inline values use `!important` so the @media print rules in
      // globals.css can't accidentally hide them. The outer div keeps
      // the same shape as v1 (hidden in-screen, fixed full-viewport in
      // print preview) so the @media print cascade works unchanged.
      className="hidden print:block fixed inset-0 p-8 text-black"
      style={{
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important',
        backgroundColor: '#FFD700 !important',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
      aria-hidden="true"
    >
      <div
        className="mx-auto text-center"
        style={{
          maxWidth: '500px',
          backgroundColor: '#FFFFFF !important',
          border: '4px solid #B8860B',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Badge emoji — circular ring */}
        <div
          style={{
            width: '180px',
            height: '180px',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFF8DC !important',
            border: '4px solid #FFD700',
            borderRadius: '50%',
            fontSize: '100px',
            lineHeight: '100px',
          }}
        >
          {badge.badge.emoji}
        </div>

        {/* Tier sub-label (e.g. "TIER 2 — APPRENTICE") */}
        <p
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: 600,
            color: '#B8860B',
            margin: '0 0 8px',
          }}
        >
          {tierLabel(badge.badge.tier)}
        </p>

        {/* Badge name */}
        <h1
          style={{
            fontSize: '40px',
            fontWeight: 'bold',
            color: '#92400E',
            margin: '0 0 4px',
          }}
        >
          {badge.badge.name}
        </h1>

        {/* Sanskrit / translation */}
        <p
          style={{
            fontSize: '18px',
            fontStyle: 'italic',
            color: '#B45309',
            margin: '0 0 20px',
          }}
        >
          {badge.badge.sanskrit}
        </p>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            color: '#374151',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          {badge.badge.description}
        </p>

        {/* Footer — date + ViBe brand */}
        <div
          style={{
            borderTop: '1px solid #FCD34D',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: '#6B7280',
              textAlign: 'left',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Earned {badge.earnedAt?.toLocaleDateString() ?? ''}
            <br />
            <span style={{ color: '#9CA3AF' }}>
              Verified by {VIBE_WORDMARK}
            </span>
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <img
              src={VIBE_LOGO_SRC}
              alt={`${VIBE_WORDMARK} logo`}
              width={32}
              height={32}
            />
            <span
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#92400E',
              }}
            >
              {VIBE_WORDMARK}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Human-readable tier label, e.g. "Tier 1 — Entry". */
function tierLabel(tier: string): string {
  const cap = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `Tier ${tierToNumber(tier)} — ${cap}`;
}

function tierToNumber(tier: string): number {
  switch (tier) {
    case 'entry':
      return 1;
    case 'apprentice':
      return 2;
    case 'courtier':
      return 3;
    case 'royalty':
      return 4;
    default:
      return 1;
  }
}

// ── PDF (print-to-PDF) ─────────────────────────────────────────────────────

function handleExportPdf(_badge: BadgeProgress): void {
  // Toggle a print-only class on <html> so the printable area renders.
  // Restore after the print dialog closes.
  document.documentElement.classList.add('motivation-printing');
  const cleanup = () => {
    document.documentElement.classList.remove('motivation-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Give the browser a tick to apply the class before opening the dialog.
  setTimeout(() => {
    window.print();
  }, 50);
}

// ── JPEG (canvas) ──────────────────────────────────────────────────────────

function handleExportJpeg(badge: BadgeProgress): void {
  // Wait for the logo to load before drawing so it lands in the JPEG.
  loadVibeLogo().then((logo) => {
    drawBadgeJpeg(badge, logo);
  });
}

function drawBadgeJpeg(
  badge: BadgeProgress,
  logo: HTMLImageElement | null,
): void {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    alert('Could not render JPEG — your browser does not support canvas.');
    return;
  }

  // ── Background: gold gradient (matches PDF) ─────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(1, '#FFA500');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Inner white card ────────────────────────────────────────────────────
  const cardX = 60;
  const cardY = 60;
  const cardW = W - 120;
  const cardH = H - 120;
  const cardR = 32;

  // Soft shadow under the card
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Card border (gold)
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // ── Badge emoji in a circular ring ──────────────────────────────────────
  const ringCx = W / 2;
  const ringCy = 360;
  const ringR = 150;

  // Cream ring background
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF8DC';
  ctx.fill();
  // Gold ring border
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Emoji glyph (centre of ring)
  ctx.font = '180px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(badge.badge.emoji, ringCx, ringCy + 8);

  // ── Tier sub-label (e.g. "TIER 2 — APPRENTICE") ─────────────────────────
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#B8860B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tierLabel(badge.badge.tier).toUpperCase(), ringCx, ringCy + ringR + 40);

  // ── Badge name ──────────────────────────────────────────────────────────
  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = '#92400E';
  ctx.fillText(badge.badge.name, ringCx, ringCy + ringR + 110);

  // ── Sanskrit / translation ───────────────────────────────────────────────
  ctx.font = 'italic 32px sans-serif';
  ctx.fillStyle = '#B45309';
  ctx.fillText(badge.badge.sanskrit, ringCx, ringCy + ringR + 165);

  // ── Description (wrap if needed) ─────────────────────────────────────────
  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#374151';
  const descLines = wrapText(ctx, badge.badge.description, cardW - 120);
  const descStartY = ringCy + ringR + 230;
  descLines.forEach((line, i) => {
    ctx.fillText(line, ringCx, descStartY + i * 36);
  });

  // ── Footer divider ──────────────────────────────────────────────────────
  const footerY = cardY + cardH - 90;
  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 40, footerY);
  ctx.lineTo(cardX + cardW - 40, footerY);
  ctx.stroke();

  // ── Footer: "Earned [date] · Verified by ViBe" (left) ───────────────────
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#6B7280';
  const earnedDate = badge.earnedAt
    ? badge.earnedAt.toLocaleDateString()
    : '';
  ctx.fillText(`Earned ${earnedDate}`, cardX + 40, footerY + 16);
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Verified by ${VIBE_WORDMARK}`, cardX + 40, footerY + 46);

  // ── Footer: ViBe logo + wordmark (right) ────────────────────────────────
  const brandX = cardX + cardW - 40;
  const brandY = footerY + 24;

  if (logo) {
    // Logo box: 56x56, vertically centred with the wordmark
    const logoSize = 56;
    const wordmarkText = VIBE_WORDMARK;
    ctx.font = 'bold 32px sans-serif';
    const wordmarkWidth = ctx.measureText(wordmarkText).width;
    const totalWidth = logoSize + 12 + wordmarkWidth;

    const logoX = brandX - totalWidth;
    const logoY = brandY - 8;
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 32px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(wordmarkText, logoX + logoSize + 12, logoY + logoSize / 2);
  } else {
    // Fallback — text-only branding
    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 32px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(VIBE_WORDMARK, brandX, brandY + 12);
  }

  // ── Trigger download ────────────────────────────────────────────────────
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${badge.badge.id}-badge.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.92);
}

/** Draws a rounded-rectangle path. ctx.fill() / ctx.stroke() afterwards. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Word-wrap a string to fit a max pixel width. Returns array of lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Share (navigator.share + fallback) ─────────────────────────────────────

async function handleShare(badge: BadgeProgress): Promise<void> {
  const text = `I earned the ${badge.badge.name} badge (${badge.badge.sanskrit}) on Vikram-Betaal! Verified by ${VIBE_WORDMARK}.`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `${badge.badge.name} — ${VIBE_WORDMARK}`,
        text,
      });
      return;
    } catch (err) {
      // User cancelled or share failed. Fall through to download.
      console.warn('navigator.share failed, falling back to download', err);
    }
  }
  // Fallback: download JPEG.
  handleExportJpeg(badge);
}
