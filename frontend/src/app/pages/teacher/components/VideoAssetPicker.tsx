import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, ChevronDown, Search, Video as VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVideoAssets } from '@/hooks/media-hooks';
import type { VideoAsset } from '@/types/media.types';

/**
 * Picks a video from the course's library for a lesson to play a slice of.
 *
 * Only READY videos are offered — a still-processing upload has no playlist to
 * segment against, so selecting one would produce a lesson that cannot play.
 * Uploading happens on the course videos page rather than here: the same lecture
 * is normally split across several lessons, and uploading per lesson would pay
 * for a transcode each time.
 */
export interface VideoAssetPickerProps {
  courseId: string;
  courseVersionId: string;
  /** Currently selected asset, if any. */
  assetId?: string;
  onSelect: (asset: VideoAsset) => void;
  disabled?: boolean;
}

export default function VideoAssetPicker({
  courseId,
  courseVersionId,
  assetId,
  onSelect,
  disabled = false,
}: VideoAssetPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without this the list stays open over
  // the timestamp fields directly below it and blocks editing them.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // readyOnly keeps unplayable videos out of the list entirely rather than
  // showing them disabled, since they cannot be chosen anyway.
  const { assets, isLoading } = useVideoAssets(courseId, courseVersionId, {
    search,
    readyOnly: true,
  });

  // The selected video may not be in the current (searched) page, so look it up
  // separately or the label would blank out while filtering.
  const { assets: allAssets } = useVideoAssets(courseId, courseVersionId, {
    readyOnly: true,
    enabled: Boolean(assetId),
  });

  const selected = useMemo(
    () =>
      allAssets.find(a => a.assetId === assetId) ??
      assets.find(a => a.assetId === assetId),
    [allAssets, assets, assetId],
  );

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <VideoIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? selected.title : 'Choose a video from this course'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search by name"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-1">
              {isLoading && (
                <p className="p-3 text-sm text-muted-foreground">Loading…</p>
              )}

              {!isLoading && assets.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  {search ? (
                    <>No processed videos match “{search}”.</>
                  ) : (
                    <>
                      No processed videos in this course yet.{' '}
                      <Link
                        to="/teacher/courses/videos"
                        className="underline"
                        onClick={() => setOpen(false)}
                      >
                        Upload one
                      </Link>
                      , then come back — processing takes a few minutes.
                    </>
                  )}
                </div>
              )}

              {assets.map(asset => (
                <button
                  key={asset.assetId}
                  type="button"
                  onClick={() => {
                    onSelect(asset);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm
                    px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {asset.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDuration(asset.durationSeconds)} ·{' '}
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  {asset.assetId === assetId && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Videos are uploaded on the{' '}
        <Link to="/teacher/courses/videos" className="underline">
          course videos
        </Link>{' '}
        page and can be reused across several lessons.
      </p>
    </div>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'Length unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
