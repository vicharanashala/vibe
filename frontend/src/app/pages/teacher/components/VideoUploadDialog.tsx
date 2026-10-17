import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileVideo, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVideoUpload } from '@/hooks/media-hooks';

/**
 * Client-side copy of the server's limit, so a teacher who picks a 3 GB file is
 * told immediately rather than after the request. The server enforces it too —
 * this is for feedback, not for security.
 */
const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;

/** Filename without its extension — a far better default title than REC_0042.mp4. */
function suggestTitle(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '') || fileName;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Collects a name and description *before* uploading.
 *
 * Naming up front rather than renaming afterwards matters here: a large lecture
 * takes minutes to upload, and the library is shared between instructors — an
 * untitled row sitting there mid-upload is not obviously anyone's.
 */
export interface VideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseVersionId: string;
  onUploaded?: (assetId: string) => void;
}

export default function VideoUploadDialog({
  open,
  onOpenChange,
  courseId,
  courseVersionId,
  onUploaded,
}: VideoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, cancel, reset, phase, progress, error } = useVideoUpload();
  const isUploading =
    phase === 'requesting' || phase === 'uploading' || phase === 'finalizing';

  const clearForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChosen = (chosen?: File | null) => {
    if (!chosen) return;

    // `accept` only filters the dialog; a user can still choose "All files", so the
    // extension is checked properly here too. The server checks it as well.
    if (!/\.mp4$/i.test(chosen.name)) {
      toast.error('Only MP4 files can be uploaded at the moment.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `That file is ${formatBytes(chosen.size)}. The maximum upload size is 2 GB — ` +
        'please compress it or split the recording.',
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(chosen);
    // Only prefill while untouched, so a typed title is never overwritten by
    // swapping the file.
    setTitle(current => current.trim() || suggestTitle(chosen.name));
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    const result = await upload(file, {
      courseId,
      courseVersionId,
      title: title.trim(),
      description: description.trim() || undefined,
    });
    if (result) {
      toast.success('Upload complete — processing has started.');
      onUploaded?.(result.assetId);
      clearForm();
      onOpenChange(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    // Closing mid-upload would abandon it silently and leave a stuck record, so
    // require an explicit cancel first.
    if (!next && isUploading) return;
    if (!next) clearForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a video</DialogTitle>
          <DialogDescription>
            Upload the full lecture. You can split it into lessons afterwards by
            choosing start and end times.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-title">Name *</Label>
            <Input
              id="video-title"
              placeholder="e.g. Week 3 — Recursion"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isUploading}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video-description">Description</Label>
            <textarea
              id="video-description"
              placeholder="Optional — what this recording covers"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isUploading}
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm
                text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label>Video file *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,.mp4"
              className="hidden"
              onChange={e => handleFileChosen(e.target.files?.[0])}
            />

            {file ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="flex min-w-0 items-center gap-2">
                  <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                </span>
                {!isUploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center">
                <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">
                  MP4 only · up to 2 GB
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === 'requesting' && 'Preparing upload…'}
                  {phase === 'uploading' && `Uploading… ${progress}%`}
                  {phase === 'finalizing' && 'Finishing up…'}
                </span>
                {phase === 'uploading' && (
                  <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                    <X className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                )}
              </div>
              <Progress value={progress} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Keep this open until the bar completes. Processing afterwards
                continues on its own.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || !title.trim() || isUploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
