import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }

    if (!('IntersectionObserver' in window)) {
      // @ts-expect-error - jsdom polyfill
      window.IntersectionObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = () => [];
        root = null;
        rootMargin = '';
        thresholds = [];
      };
    }

    if (!('ResizeObserver' in window)) {
      // @ts-expect-error - jsdom polyfill
      window.ResizeObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      };
    }

    if (typeof URL.createObjectURL === 'undefined') {
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), writable: true });
    }
    if (typeof URL.revokeObjectURL === 'undefined') {
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    }

    if (!HTMLMediaElement.prototype.play) {
      HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    }
    if (!HTMLMediaElement.prototype.pause) {
      HTMLMediaElement.prototype.pause = vi.fn();
    }
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn(() => () => undefined),
  createUserWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));
