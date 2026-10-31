import { useNavigate } from '@tanstack/react-router';
import { LinkIcon, PlayIcon, RefreshCwIcon, ScissorsIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { toSeconds, youtubeId } from '@/features/learn/queries';

import { ErrorText } from '../studio-ui';
import { EditorFrame, TitleFields, type SaveState } from './editor-frame';
import {
  useSaveLesson,
  type LessonItem,
  type LessonLocation,
} from './lesson-api';

/** The backend's time format: m:ss, mm:ss or h:mm:ss. */
const TIME = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

/** Substack-style video lesson: the video up top, then title and subtitle. YouTube links only. */
export function VideoEditor({
  loc,
  item,
}: {
  loc: LessonLocation;
  item?: LessonItem;
}) {
  const save = useSaveLesson(loc, item?._id);
  const navigate = useNavigate();
  const isGcs = item?.details?.source === 'GCS';
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [url, setUrl] = useState<string>(item?.details?.URL ?? '');
  const [startTime, setStartTime] = useState<string>(
    item?.details?.startTime ?? '0:00',
  );
  const [endTime, setEndTime] = useState<string>(item?.details?.endTime ?? '');
  const [points, setPoints] = useState<number>(
    Number(item?.details?.points ?? 10),
  );
  const [dirty, setDirty] = useState(false);
  const [editingUrl, setEditingUrl] = useState(!url);

  const id = youtubeId(url);
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  const startOk = TIME.test(startTime);
  const endOk = TIME.test(endTime);
  const orderOk =
    !startOk || !endOk || toSeconds(endTime) > toSeconds(startTime);
  const missing =
    !id && !isGcs
      ? 'Add a YouTube link'
      : !startOk || !endOk
        ? 'Set the clip’s start and end (like 0:00 and 12:30)'
        : !orderOk
          ? 'The clip must end after it starts'
          : !name.trim()
            ? 'Add a title'
            : !description.trim()
              ? 'Add a subtitle'
              : null;
  const state: SaveState = save.isPending
    ? 'saving'
    : save.isError
      ? 'error'
      : dirty
        ? item
          ? 'dirty'
          : 'new'
        : save.isSuccess
          ? 'saved'
          : item
            ? 'clean'
            : 'new';

  function onSave() {
    if (missing) {
      toast.error(missing);
      return;
    }
    save.mutate(
      {
        type: 'VIDEO',
        name: name.trim(),
        description: description.trim(),
        details: {
          ...(item?.details ?? {}),
          URL: url,
          startTime,
          endTime,
          points,
        },
      },
      {
        onSuccess: (newId) => {
          setDirty(false);
          toast.success(item ? 'Video saved.' : 'Video published.');
          if (!item)
            void navigate({
              to: '/admin/courses/$courseId/$versionId/lesson',
              params: loc,
              search: {
                module: loc.moduleId,
                section: loc.sectionId,
                item: newId,
              },
              replace: true,
              ignoreBlocker: true,
            });
        },
      },
    );
  }

  const embedStart = Math.floor(toSeconds(startOk ? startTime : '0:00'));
  const embedEnd = endOk ? Math.floor(toSeconds(endTime)) : undefined;

  return (
    <EditorFrame
      loc={loc}
      itemId={item?._id}
      dirty={dirty}
      kind="Video"
      state={state}
      onSave={onSave}
      saveLabel={item ? 'Save' : 'Publish'}
    >
      {save.isError && (
        <ErrorText
          error={save.error}
          className="mb-6 rounded-lg bg-destructive/10 px-3 py-2"
        />
      )}

      {isGcs ? (
        <div className="grid aspect-video place-items-center rounded-2xl border border-border bg-muted px-6 text-center text-sm text-muted-foreground">
          This video is stored on ViBe’s own storage. Its file can’t be changed
          here yet; the title, subtitle, clip and points can.
        </div>
      ) : id && !editingUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
          <iframe
            key={`${id}:${embedStart}:${embedEnd ?? ''}`}
            title="Video preview"
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?start=${embedStart}${embedEnd ? `&end=${embedEnd}` : ''}&rel=0&modestbranding=1`}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <UrlPicker
          initial={url}
          onCancel={id ? () => setEditingUrl(false) : undefined}
          onPick={(next) => {
            touch(setUrl)(next);
            setEditingUrl(false);
          }}
        />
      )}

      {!isGcs && id && !editingUrl && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditingUrl(true)}>
            <RefreshCwIcon aria-hidden /> Replace video
          </Button>
        </div>
      )}

      <section
        aria-label="Clip"
        className="mt-4 rounded-2xl border border-border bg-card p-4"
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          <ScissorsIcon className="size-4 text-primary" aria-hidden /> Clip
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Students watch only this part. Use it to pick one segment of a longer
          video.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field data-invalid={!startOk || undefined}>
            <FieldLabel htmlFor="clip-start">Start</FieldLabel>
            <Input
              id="clip-start"
              placeholder="0:00"
              value={startTime}
              onChange={(e) => touch(setStartTime)(e.target.value.trim())}
              aria-invalid={!startOk}
            />
          </Field>
          <Field
            data-invalid={
              (!endOk || !orderOk) && endTime !== '' ? true : undefined
            }
          >
            <FieldLabel htmlFor="clip-end">End</FieldLabel>
            <Input
              id="clip-end"
              placeholder="12:30"
              value={endTime}
              onChange={(e) => touch(setEndTime)(e.target.value.trim())}
              aria-invalid={endTime !== '' && (!endOk || !orderOk)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="clip-points">Points</FieldLabel>
            <Input
              id="clip-points"
              type="number"
              min={0}
              value={points}
              onChange={(e) => touch(setPoints)(Number(e.target.value))}
            />
          </Field>
        </div>
        {endTime !== '' && endOk && !orderOk ? (
          <FieldError className="mt-2">
            The clip must end after it starts.
          </FieldError>
        ) : (
          <FieldDescription className="mt-2">
            Times are m:ss or h:mm:ss.
          </FieldDescription>
        )}
      </section>

      <div className="mt-10">
        <TitleFields
          title={name}
          onTitle={touch(setName)}
          subtitle={description}
          onSubtitle={touch(setDescription)}
          subtitlePlaceholder="What will students learn from this video?"
        />
      </div>
    </EditorFrame>
  );
}

function UrlPicker({
  initial,
  onPick,
  onCancel,
}: {
  initial: string;
  onPick: (url: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!youtubeId(value.trim())) {
      setError('That doesn’t look like a YouTube link.');
      return;
    }
    onPick(value.trim());
  }

  return (
    <form
      onSubmit={submit}
      className="grid aspect-video place-items-center rounded-2xl border-2 border-dashed border-border bg-card px-6"
    >
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-blush text-blush-foreground">
          <PlayIcon className="size-5" aria-hidden />
        </span>
        <p className="mt-3 font-medium">Add a video</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a YouTube link. You can trim it to a clip below.
        </p>
        <div className="mt-4 flex gap-2">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <LinkIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="YouTube link"
              placeholder="https://www.youtube.com/watch?v=…"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              autoFocus
            />
          </InputGroup>
          <Button type="submit">Add</Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
