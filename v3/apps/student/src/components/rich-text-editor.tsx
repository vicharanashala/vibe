import Image from '@tiptap/extension-image';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

/**
 * Tiptap rich-text editor. The value in and out is an HTML string (`editor.getHTML()`),
 * which is what lesson content and question text are stored as; students see it through
 * <RichContent>, which sanitizes it.
 *
 *   variant="article"  — Substack-style: sticky toolbar, headings, images, quotes.
 *   variant="compact"  — a bordered field with inline formatting only (quiz text).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  variant = 'compact',
  className,
  ariaLabel,
  autofocus,
  onWordCount,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variant?: 'article' | 'compact';
  className?: string;
  ariaLabel?: string;
  autofocus?: boolean;
  onWordCount?: (words: number) => void;
}) {
  const article = variant === 'article';
  const keyboardInset = useKeyboardInset(article);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: article ? { levels: [2, 3] } : false,
        horizontalRule: article ? {} : false,
        blockquote: article ? {} : false,
        codeBlock: article ? {} : false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      ...(article
        ? [Image.configure({ HTMLAttributes: { loading: 'lazy' } })]
        : []),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount,
    ],
    content: value,
    autofocus: autofocus ? 'end' : false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose-vibe tiptap outline-none',
          article
            ? 'min-h-[50vh] text-[17px] leading-8'
            : 'min-h-16 px-3 py-2.5 text-sm leading-6',
        ),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? '' : e.getHTML());
      onWordCount?.(e.storage.characterCount.words());
    },
    onCreate: ({ editor: e }) =>
      onWordCount?.(e.storage.characterCount.words()),
  });

  // Content loaded after mount (e.g. an existing lesson) replaces the document.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (article) {
    return (
      <div className={className}>
        {/* Desktop: sticky under the top bar. Phones: docked at the bottom, riding above the keyboard (Substack-style). */}
        <div
          style={{ '--kb': `${keyboardInset}px` } as CSSProperties}
          className="z-20 border-border bg-background/95 backdrop-blur md:sticky md:top-14 md:-mx-2 md:mb-6 md:border-b md:px-2 md:py-1.5 max-md:fixed max-md:inset-x-0 max-md:bottom-(--kb) max-md:border-t max-md:px-1 max-md:py-1 max-md:pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        >
          <Toolbar editor={editor} full />
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-lg border border-input bg-card transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25',
        className,
      )}
    >
      <div className="border-b border-border px-1 py-0.5">
        <Toolbar editor={editor} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, full }: { editor: Editor | null; full?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            link: e.isActive('link'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            style: e.isActive('heading', { level: 2 })
              ? 'Heading'
              : e.isActive('heading', { level: 3 })
                ? 'Subheading'
                : e.isActive('codeBlock')
                  ? 'Code block'
                  : 'Paragraph',
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });
  if (!editor || !state) return <div className="h-8" />;

  const chain = () => editor.chain().focus();
  const size = 'sm' as const;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        'flex items-center gap-0.5',
        full
          ? 'overflow-x-auto [scrollbar-width:none] md:justify-center'
          : 'flex-wrap',
      )}
    >
      {full && (
        <>
          <ToolButton
            icon={Undo2Icon}
            label="Undo"
            size={size}
            disabled={!state.canUndo}
            onClick={() => chain().undo().run()}
          />
          <ToolButton
            icon={Redo2Icon}
            label="Redo"
            size={size}
            disabled={!state.canRedo}
            onClick={() => chain().redo().run()}
          />
          <Divider />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-8 w-28 justify-between gap-1 px-2.5 font-normal"
                />
              }
            >
              {state.style}{' '}
              <ChevronDownIcon className="size-3.5 opacity-60" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => chain().setParagraph().run()}>
                Paragraph
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => chain().toggleHeading({ level: 2 }).run()}
                className="font-aleo text-lg"
              >
                Heading
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => chain().toggleHeading({ level: 3 }).run()}
                className="font-aleo text-base"
              >
                Subheading
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => chain().toggleCodeBlock().run()}
                className="font-mono text-xs"
              >
                Code block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Divider />
        </>
      )}
      <ToolToggle
        icon={BoldIcon}
        label="Bold"
        size={size}
        pressed={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolToggle
        icon={ItalicIcon}
        label="Italic"
        size={size}
        pressed={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolToggle
        icon={UnderlineIcon}
        label="Underline"
        size={size}
        pressed={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      {full && (
        <ToolToggle
          icon={StrikethroughIcon}
          label="Strikethrough"
          size={size}
          pressed={state.strike}
          onClick={() => chain().toggleStrike().run()}
        />
      )}
      <ToolToggle
        icon={CodeIcon}
        label="Inline code"
        size={size}
        pressed={state.code}
        onClick={() => chain().toggleCode().run()}
      />
      <Divider />
      <LinkButton editor={editor} active={state.link} size={size} />
      {full && <ImageButton editor={editor} />}
      <Divider />
      <ToolToggle
        icon={ListIcon}
        label="Bulleted list"
        size={size}
        pressed={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolToggle
        icon={ListOrderedIcon}
        label="Numbered list"
        size={size}
        pressed={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      {full && (
        <>
          <ToolToggle
            icon={QuoteIcon}
            label="Quote"
            size={size}
            pressed={state.quote}
            onClick={() => chain().toggleBlockquote().run()}
          />
          <ToolButton
            icon={MinusIcon}
            label="Divider"
            size={size}
            onClick={() => chain().setHorizontalRule().run()}
          />
        </>
      )}
    </div>
  );
}

function Divider() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center"
    />
  );
}

function ToolToggle({
  icon: Icon,
  label,
  pressed,
  onClick,
  size,
}: {
  icon: LucideIcon;
  label: string;
  pressed: boolean;
  onClick: () => void;
  size: 'default' | 'sm';
}) {
  return (
    <Toggle
      size={size}
      aria-label={label}
      title={label}
      pressed={pressed}
      onPressedChange={onClick}
      className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
    >
      <Icon aria-hidden />
    </Toggle>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  size,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  size: 'default' | 'sm';
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size === 'sm' ? 'icon-sm' : 'icon'}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
}

/** A small popover with one URL field, used for links and images. */
function UrlPopover({
  trigger,
  title,
  initial,
  submitLabel,
  onSubmit,
  onRemove,
}: {
  trigger: ReactNode;
  title: string;
  initial: string;
  submitLabel: string;
  onSubmit: (url: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initial);

  function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (url.trim()) onSubmit(url.trim());
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(initial);
      }}
    >
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="grid gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Input
            type="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              {submitLabel}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function LinkButton({
  editor,
  active,
  size,
}: {
  editor: Editor;
  active: boolean;
  size: 'default' | 'sm';
}) {
  return (
    <UrlPopover
      title={active ? 'Edit link' : 'Add link'}
      initial={(editor.getAttributes('link').href as string | undefined) ?? ''}
      submitLabel="Apply"
      onSubmit={(href) => {
        const { empty } = editor.state.selection;
        if (empty && !active) {
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'text',
              text: href,
              marks: [{ type: 'link', attrs: { href } }],
            })
            .run();
        } else {
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href })
            .run();
        }
      }}
      onRemove={
        active
          ? () =>
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
          : undefined
      }
      trigger={
        <Toggle
          size={size}
          aria-label="Link"
          title="Link"
          pressed={active}
          className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
        >
          <LinkIcon aria-hidden />
        </Toggle>
      }
    />
  );
}

function ImageButton({ editor }: { editor: Editor }) {
  return (
    <UrlPopover
      title="Image from a link"
      initial=""
      submitLabel="Insert"
      onSubmit={(src) => editor.chain().focus().setImage({ src }).run()}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Image"
          title="Image"
        >
          <ImageIcon aria-hidden />
        </Button>
      }
    />
  );
}

/**
 * Height of the on-screen keyboard (0 on desktop): how far a bottom-docked bar
 * must sit above the layout viewport's bottom to stay visible while typing.
 */
function useKeyboardInset(enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) return;
    const update = () =>
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return inset;
}
