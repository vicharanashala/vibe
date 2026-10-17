import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import HlsVideoPlayer from '@/components/HlsVideoPlayer';
import VideoUploadDialog from './components/VideoUploadDialog';
import { useCourseStore } from '@/store/course-store';
import {
  useDeleteVideoAsset,
  useUpdateVideoAsset,
  useVideoAssets,
} from '@/hooks/media-hooks';
import type { VideoAsset, VideoAssetStatus } from '@/types/media.types';

/**
 * A course's video library.
 *
 * Lectures are uploaded here once and then referenced by any number of video
 * items, each covering a different time range. That separation is the point:
 * uploading the same recording per segment would pay for a transcode every time.
 *
 * Visible to every instructor on the course version, not only the uploader.
 */
export default function CourseVideosPage() {
  const { currentCourse } = useCourseStore();
  const courseId = currentCourse?.courseId ?? undefined;
  const versionId = currentCourse?.versionId ?? undefined;

  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<VideoAsset | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { assets, isLoading, isFetching, refetch } = useVideoAssets(
    courseId,
    versionId,
    { search },
  );
  const updateAsset = useUpdateVideoAsset();
  const deleteAsset = useDeleteVideoAsset();

  const processingCount = useMemo(
    () =>
      assets.filter(a => a.status === 'UPLOADING' || a.status === 'PROCESSING')
        .length,
    [assets],
  );

  const startRename = (asset: VideoAsset) => {
    setRenamingId(asset.assetId);
    setRenameValue(asset.title);
  };

  const commitRename = async (asset: VideoAsset) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === asset.title) return;
    try {
      await updateAsset.mutateAsync({ assetId: asset.assetId, title });
      toast.success('Renamed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed.');
    }
  };

  const handleDelete = async (asset: VideoAsset) => {
    if (
      !window.confirm(
        `Remove "${asset.title}" from the library? Lessons already using it will keep working.`,
      )
    ) {
      return;
    }
    try {
      await deleteAsset.mutateAsync(asset.assetId);
      toast.success('Removed from the library.');
    } catch (err) {
      // The most common cause is the asset still being used by a lesson, which
      // the backend refuses precisely so that lesson does not break.
      toast.error(err instanceof Error ? err.message : 'Could not remove it.');
    }
  };

  if (!courseId || !versionId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Open a course first to see its videos.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Course videos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload a full lecture once, then reuse it across as many lessons as
            you like — each lesson plays whatever start and end time you choose.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            title="Refresh"
            aria-label="Refresh video list"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload video
          </Button>
        </div>
      </div>

      {processingCount > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {processingCount} video{processingCount > 1 ? 's' : ''} still
          processing — this updates automatically.
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-24">Length</TableHead>
              <TableHead className="w-36">Uploaded</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}

            {!isLoading && assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {search
                    ? `No videos match "${search}".`
                    : 'No videos yet. Upload a lecture to get started.'}
                </TableCell>
              </TableRow>
            )}

            {assets.map(asset => (
              <TableRow key={asset.assetId}>
                <TableCell>
                  {renamingId === asset.assetId ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => void commitRename(asset)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void commitRename(asset);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="h-8 max-w-sm"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(asset)}
                      className="text-left font-medium hover:underline"
                      title="Click to rename"
                    >
                      {asset.title}
                    </button>
                  )}
                  {asset.status === 'FAILED' && asset.failureReason && (
                    <p className="mt-1 text-xs text-destructive">
                      {asset.failureReason}
                    </p>
                  )}
                </TableCell>

                <TableCell>
                  <StatusBadge status={asset.status} />
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(asset.durationSeconds)}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  <span className="block">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </span>
                  <span className="block text-xs">
                    {new Date(asset.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!asset.playable}
                      onClick={() => setPreviewAsset(asset)}
                      title={
                        asset.playable ? 'Preview' : 'Available once processed'
                      }
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(asset)}
                      title="Remove from library"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <VideoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        courseId={courseId}
        courseVersionId={versionId}
      />

      <Dialog
        open={Boolean(previewAsset)}
        onOpenChange={open => !open && setPreviewAsset(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.title}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <HlsVideoPlayer
              assetId={previewAsset.assetId}
              className="aspect-video w-full"
              /**
               * Recording the duration here is what lets the item editor prefill
               * and validate segment timestamps without loading the video first.
               */
              onReady={seconds => {
                if (!previewAsset.durationSeconds && seconds > 0) {
                  updateAsset.mutate({
                    assetId: previewAsset.assetId,
                    durationSeconds: Math.round(seconds),
                  });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: VideoAssetStatus }) {
  if (status === 'READY') {
    return (
      <Badge variant="outline" className="gap-1 text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }
  if (status === 'FAILED') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status === 'UPLOADING' ? 'Uploading' : 'Processing'}
    </Badge>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
