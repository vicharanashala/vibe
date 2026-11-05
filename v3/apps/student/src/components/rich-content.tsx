import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/**
 * Lesson text arrives in one of two formats, both stored as a plain string:
 *   - HTML: written by the studio's Tiptap editor, and by the old frontend's
 *     Yoopta editor (it saves `html.serialize(...)`).
 *   - Markdown: older/seeded content.
 * HTML is sanitized before rendering, because it is author input shown to
 * every student.
 */
const HTML_TAG =
  /<(p|h[1-6]|ul|ol|li|div|br|strong|em|b|i|u|s|a|img|blockquote|pre|code|hr|table|span)[\s/>]/i;

export function isHtml(content: string) {
  return HTML_TAG.test(content);
}

let hooked = false;
function sanitize(html: string) {
  if (!hooked) {
    // Links open in a new tab and can't reach back into the lesson page.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
  });
}

export function RichContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(
    () => (isHtml(content) ? sanitize(content) : null),
    [content],
  );
  if (html !== null) {
    return (
      <div
        className={cn('prose-vibe', className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className={cn('prose-vibe', className)}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}

/**
 * What to load into the article editor: HTML as is, older Markdown lessons
 * converted to HTML so they open formatted (and are saved as HTML from then on).
 */
export function toArticleHtml(content: string): string {
  if (!content || isHtml(content)) return content;
  return sanitize(marked.parse(content, { async: false, gfm: true }));
}

/** Plain text of either format, e.g. to count words for a read time. */
export function plainText(content: string) {
  if (!isHtml(content)) return content.replace(/[#>*_`~[\]()!-]/g, ' ');
  const doc = new DOMParser().parseFromString(sanitize(content), 'text/html');
  return doc.body.textContent ?? '';
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Short author text (quiz questions, options, hints) is stored as plain text
 * unless it actually uses formatting, so unformatted text stays exactly what
 * the old frontend and the backend expect.
 */
export function toStoredText(editorHtml: string): string {
  const m = /^<p>([^<]*)<\/p>$/.exec(editorHtml.trim());
  if (!m) return editorHtml;
  const plain =
    new DOMParser().parseFromString(m[1], 'text/html').body.textContent ?? '';
  // Text that merely mentions a tag ("What does <p> do?") must stay escaped HTML,
  // or it would be read back as markup.
  return isHtml(plain) ? editorHtml : plain;
}

/** The inverse of toStoredText: what to load into the editor. */
export function toEditorHtml(stored: string): string {
  if (!stored) return '';
  if (isHtml(stored)) return stored;
  return stored
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Renders short author text: sanitized HTML when formatted, otherwise plain text (never Markdown, so "2*3*4" stays as typed). */
export function RichText({
  text,
  className,
  inline,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  const html = useMemo(() => (isHtml(text) ? sanitize(text) : null), [text]);
  if (html === null) {
    const Tag = inline ? 'span' : 'p';
    return <Tag className={cn('whitespace-pre-wrap', className)}>{text}</Tag>;
  }
  return (
    <div
      className={cn('prose-vibe prose-compact', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
