import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { RichContent, toArticleHtml } from '@/components/rich-content';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { ErrorText } from '../studio-ui';
import { EditorFrame, TitleFields, type SaveState } from './editor-frame';
import {
  useSaveLesson,
  type LessonItem,
  type LessonLocation,
} from './lesson-api';

const WORDS_PER_MINUTE = 200;

/** Substack-style article ("Reading") editor. The body is stored as HTML in blogDetails.content. */
export function ArticleEditor({
  loc,
  item,
}: {
  loc: LessonLocation;
  item?: LessonItem;
}) {
  const save = useSaveLesson(loc, item?._id);
  const navigate = useNavigate();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [content, setContent] = useState<string>(() =>
    toArticleHtml(item?.details?.content ?? ''),
  );
  const [points, setPoints] = useState<number>(
    Number(item?.details?.points ?? 0),
  );
  const [readTime, setReadTime] = useState<number | null>(
    item?.details?.estimatedReadTimeInMinutes ?? null,
  );
  const [words, setWords] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const autoReadTime = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  const missing = !name.trim()
    ? 'Add a title'
    : !description.trim()
      ? 'Add a subtitle'
      : !content
        ? 'Write something first'
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
        type: 'BLOG',
        name: name.trim(),
        description: description.trim(),
        details: {
          content: content.replace(/(<p><\/p>)+$/, ''),
          points,
          estimatedReadTimeInMinutes: readTime ?? autoReadTime,
        },
      },
      {
        onSuccess: (id) => {
          setDirty(false);
          toast.success(item ? 'Article saved.' : 'Article published.');
          if (!item)
            void navigate({
              to: '/admin/courses/$courseId/$versionId/lesson',
              params: loc,
              search: {
                module: loc.moduleId,
                section: loc.sectionId,
                item: id,
              },
              replace: true,
              ignoreBlocker: true,
            });
        },
      },
    );
  }

  return (
    <EditorFrame
      loc={loc}
      itemId={item?._id}
      dirty={dirty}
      kind="Article"
      state={state}
      onSave={onSave}
      saveLabel={item ? 'Save' : 'Publish'}
      preview={preview}
      onPreviewChange={setPreview}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      {save.isError && (
        <ErrorText
          error={save.error}
          className="mb-6 rounded-lg bg-destructive/10 px-3 py-2"
        />
      )}
      {preview ? (
        <article>
          <h1 className="font-aleo text-4xl leading-tight font-semibold tracking-tight">
            {name || 'Untitled'}
          </h1>
          {description && (
            <p className="mt-2 text-lg text-muted-foreground">{description}</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            About {readTime ?? autoReadTime} min read
          </p>
          <hr className="my-8 border-border" />
          <RichContent content={content} className="text-[17px] leading-8" />
        </article>
      ) : (
        <>
          <TitleFields
            title={name}
            onTitle={touch(setName)}
            subtitle={description}
            onSubtitle={touch(setDescription)}
          />
          <p className="mt-4 mb-2 text-xs text-muted-foreground">
            {words} {words === 1 ? 'word' : 'words'} · about{' '}
            {readTime ?? autoReadTime} min read
          </p>
          <RichTextEditor
            variant="article"
            value={content}
            onChange={touch(setContent)}
            onWordCount={setWords}
            placeholder="Start writing…"
            ariaLabel="Article body"
          />
        </>
      )}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Article settings</SheetTitle>
            <SheetDescription>
              How this lesson counts for students.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 px-4">
            <Field>
              <FieldLabel htmlFor="article-points">Points</FieldLabel>
              <Input
                id="article-points"
                type="number"
                min={0}
                step={0.5}
                value={points}
                onChange={(e) => touch(setPoints)(Number(e.target.value))}
              />
              <FieldDescription>
                Awarded when a student finishes reading.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="article-readtime">
                Read time (minutes)
              </FieldLabel>
              <Input
                id="article-readtime"
                type="number"
                min={1}
                placeholder={String(autoReadTime)}
                value={readTime ?? ''}
                onChange={(e) =>
                  touch(setReadTime)(
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              />
              <FieldDescription>
                Leave empty to estimate from the length ({autoReadTime} min
                now).
              </FieldDescription>
            </Field>
          </div>
        </SheetContent>
      </Sheet>
    </EditorFrame>
  );
}
