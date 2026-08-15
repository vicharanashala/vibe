import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface StudyNotesViewerProps {
  markdownContent: string;
}

export const StudyNotesViewer: React.FC<StudyNotesViewerProps> = ({ markdownContent }) => {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none space-y-4 text-slate-800 dark:text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white border-b pb-2 mb-4 border-slate-200 dark:border-slate-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-400 mt-8 mb-3 border-b pb-1 border-slate-100 dark:border-slate-800">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-base leading-7 text-slate-700 dark:text-slate-300 mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-slate-700 dark:text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold border-b border-slate-200 dark:border-slate-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60">
              {children}
            </td>
          ),
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-sm overflow-x-auto my-4 shadow-inner border border-slate-800">
                <code>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 italic bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-700 dark:text-slate-300 my-4 rounded-r-md">
              {children}
            </blockquote>
          ),
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};
