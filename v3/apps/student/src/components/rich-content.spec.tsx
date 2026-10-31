import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { isHtml, RichContent, RichText, toArticleHtml, toEditorHtml, toStoredText } from './rich-content';

describe('stored text format', () => {
  it('keeps unformatted text as plain text', () => {
    expect(toStoredText('<p>What is 2 &lt; 3?</p>')).toBe('What is 2 < 3?');
  });

  it('keeps formatted text as HTML', () => {
    const html = '<p>What is the <strong>average</strong> case?</p>';
    expect(toStoredText(html)).toBe(html);
  });

  it('does not turn text that mentions a tag into markup', () => {
    const html = '<p>What does &lt;p&gt; do?</p>';
    expect(toStoredText(html)).toBe(html);
  });

  it('loads plain text into the editor safely', () => {
    expect(toEditorHtml('a < b\nnext')).toBe('<p>a &lt; b<br>next</p>');
    expect(toEditorHtml('')).toBe('');
  });

  it('converts older Markdown articles to HTML for the editor', () => {
    expect(toArticleHtml('## Title\n\nSome **bold** text')).toBe('<h2>Title</h2>\n<p>Some <strong>bold</strong> text</p>\n');
    expect(toArticleHtml('<p>Already HTML</p>')).toBe('<p>Already HTML</p>');
  });

  it('tells HTML from Markdown', () => {
    expect(isHtml('<h2>Title</h2><p>Body</p>')).toBe(true);
    expect(isHtml('## Title\n\nSome **bold** text')).toBe(false);
  });
});

describe('rendering', () => {
  it('renders HTML content and strips scripts and handlers', () => {
    const { container } = render(<RichContent content={'<p>Hello <strong>there</strong></p><img src="x" onerror="alert(1)"><script>alert(2)</script>'} />);
    expect(screen.getByText('there').tagName).toBe('STRONG');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('opens links in a new tab without opener access', () => {
    render(<RichContent content={'<p><a href="https://example.com">site</a></p>'} />);
    const link = screen.getByRole('link', { name: 'site' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('still renders legacy Markdown lessons', () => {
    render(<RichContent content={'## Heading\n\nSome **bold** text'} />);
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeTruthy();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('shows plain quiz text exactly as typed, not as Markdown', () => {
    render(<RichText text="2*3*4 = 24" />);
    expect(screen.getByText('2*3*4 = 24')).toBeTruthy();
  });
});
