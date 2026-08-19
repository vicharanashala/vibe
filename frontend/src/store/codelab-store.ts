/**
 * CodeLab workspace store.
 *
 * Workspace is per-user and platform-wide (not scoped to a course/item).
 * Files persist across page reloads because the workspace "belongs to the
 * learner's account, not the page session" (product.md §6.20).
 *
 * Storage key is namespaced by userId so different learners on the same
 * browser get independent workspaces.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CodeLabFile {
  id: string;
  name: string;
  content: string;
  language: string;
}

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 50 * 1024; // 50 KB

/**
 * Languages/frameworks whose runtime cannot be executed live inside CodeLab.
 * For these, CodeLab provides read-only templates with predefined output.
 */
export const READ_ONLY_LANGUAGES = new Set([
  'mongodb',
  'mongo',
  'express',
  'node',
  'numpy',
  'pandas',
  'matplotlib',
  'tensorflow',
  'pytorch',
  'django',
  'flask',
  'spring',
  'java',
  'csharp',
  'cpp',
  'c',
  'rust',
  'go',
]);

/**
 * Languages that can be executed live in the browser (via JS eval or
 * a sandboxed worker). Anything NOT in this set uses a read-only template.
 */
export const RUNNABLE_LANGUAGES = new Set(['javascript', 'js', 'typescript', 'ts', 'python', 'html']);

export interface CodeLabState {
  // Map of userId → files array; enables platform-wide, per-user workspace.
  workspaces: Record<string, CodeLabFile[]>;
  // Map of userId → currently active file id.
  activeFileIds: Record<string, string | null>;

  /** Get files for the given userId. */
  getFiles: (userId: string) => CodeLabFile[];
  /** Get active file id for user. */
  getActiveFileId: (userId: string) => string | null;

  /** Create a new file. Returns error string on limit/size violation. */
  createFile: (userId: string, name: string, language: string) => string | null;
  /** Update file content. Returns error string on size violation. */
  updateFile: (userId: string, fileId: string, content: string) => string | null;
  /** Rename a file. */
  renameFile: (userId: string, fileId: string, name: string) => void;
  /** Delete a file. */
  deleteFile: (userId: string, fileId: string) => void;
  /** Set active file. */
  setActiveFile: (userId: string, fileId: string | null) => void;
  /** Reset workspace: clear all files and create a fresh empty workspace. */
  resetWorkspace: (userId: string) => void;
}

function defaultFiles(): CodeLabFile[] {
  return [
    {
      id: 'main',
      name: 'main.js',
      language: 'javascript',
      content: '// Welcome to CodeLab!\n// Write your code here and press Run to execute it.\n\nconsole.log("Hello, world!");\n',
    },
  ];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useCodeLabStore = create<CodeLabState>()(
  persist(
    (set, get) => ({
      workspaces: {},
      activeFileIds: {},

      getFiles(userId) {
        const ws = get().workspaces[userId];
        if (!ws || ws.length === 0) {
          // Lazily initialize with the default file on first access.
          const files = defaultFiles();
          set((s) => ({
            workspaces: { ...s.workspaces, [userId]: files },
            activeFileIds: { ...s.activeFileIds, [userId]: files[0].id },
          }));
          return files;
        }
        return ws;
      },

      getActiveFileId(userId) {
        const files = get().workspaces[userId];
        const active = get().activeFileIds[userId];
        if (!files || files.length === 0) return null;
        // If stored active id is still valid, return it.
        if (active && files.some((f) => f.id === active)) return active;
        // Otherwise fall back to first file.
        return files[0]?.id ?? null;
      },

      createFile(userId, name, language) {
        const files = get().getFiles(userId);
        if (files.length >= MAX_FILES) {
          return `Workspace limit reached (${MAX_FILES} files). Download and Reset your workspace to continue.`;
        }
        const newFile: CodeLabFile = { id: uid(), name, language, content: '' };
        set((s) => ({
          workspaces: { ...s.workspaces, [userId]: [...(s.workspaces[userId] ?? []), newFile] },
          activeFileIds: { ...s.activeFileIds, [userId]: newFile.id },
        }));
        return null;
      },

      updateFile(userId, fileId, content) {
        if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
          return `File exceeds the 50 KB limit. Please reduce its size.`;
        }
        set((s) => ({
          workspaces: {
            ...s.workspaces,
            [userId]: (s.workspaces[userId] ?? []).map((f) =>
              f.id === fileId ? { ...f, content } : f
            ),
          },
        }));
        return null;
      },

      renameFile(userId, fileId, name) {
        set((s) => ({
          workspaces: {
            ...s.workspaces,
            [userId]: (s.workspaces[userId] ?? []).map((f) =>
              f.id === fileId ? { ...f, name } : f
            ),
          },
        }));
      },

      deleteFile(userId, fileId) {
        set((s) => {
          const files = (s.workspaces[userId] ?? []).filter((f) => f.id !== fileId);
          const active = s.activeFileIds[userId];
          const newActive =
            active === fileId ? (files[0]?.id ?? null) : active;
          return {
            workspaces: { ...s.workspaces, [userId]: files },
            activeFileIds: { ...s.activeFileIds, [userId]: newActive },
          };
        });
      },

      setActiveFile(userId, fileId) {
        set((s) => ({ activeFileIds: { ...s.activeFileIds, [userId]: fileId } }));
      },

      resetWorkspace(userId) {
        const fresh = defaultFiles();
        set((s) => ({
          workspaces: { ...s.workspaces, [userId]: fresh },
          activeFileIds: { ...s.activeFileIds, [userId]: fresh[0].id },
        }));
      },
    }),
    {
      name: 'codelab-workspace',
    }
  )
);
