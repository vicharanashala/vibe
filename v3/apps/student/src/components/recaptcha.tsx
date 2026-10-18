import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/components/theme-provider';
import { FieldError } from '@/components/ui/field';
import { env } from '@/lib/env';

/**
 * Google reCAPTCHA v2 ("I'm not a robot"), the same widget and site key as the
 * current app. The backend checks the token on POST /auth/login, /auth/signup
 * and course registration when its IS_RECAPTCHA_ENABLED is "true"; with it off
 * it accepts any value, so we send NO_CAPTCHA.
 */
export const NO_CAPTCHA = 'NO_CAPTCHA';

interface Grecaptcha {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme: 'light' | 'dark';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => number;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __vibeRecaptchaReady?: () => void;
  }
}

let loading: Promise<Grecaptcha> | null = null;

function loadRecaptcha(): Promise<Grecaptcha> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  loading ??= new Promise<Grecaptcha>((resolve, reject) => {
    window.__vibeRecaptchaReady = () => resolve(window.grecaptcha!);
    const script = document.createElement('script');
    script.src =
      'https://www.google.com/recaptcha/api.js?render=explicit&onload=__vibeRecaptchaReady';
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('reCAPTCHA failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function RecaptchaWidget({
  onChange,
}: {
  onChange: (token: string | null) => void;
}) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha().then(
      (g) => {
        if (cancelled || !ref.current) return;
        // Render into a fresh child: a container can only hold one widget.
        const el = document.createElement('div');
        ref.current.replaceChildren(el);
        g.render(el, {
          sitekey: env.recaptcha.siteKey,
          theme,
          callback: (token) => onChangeRef.current(token),
          'expired-callback': () => onChangeRef.current(null),
          'error-callback': () => onChangeRef.current(null),
        });
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      onChangeRef.current(null);
    };
  }, [theme]);

  return (
    <div>
      {/* The widget is a fixed 304px wide; scale it down on very narrow screens. */}
      <div
        ref={ref}
        data-testid="recaptcha"
        className="min-h-[78px] origin-left max-[360px]:scale-90"
      />
      {failed && (
        <FieldError>
          Couldn’t load the “I’m not a robot” check. Check your connection or
          turn off content blockers, then reload the page.
        </FieldError>
      )}
    </div>
  );
}

/**
 * State for one form's reCAPTCHA. `token` is what to send as recaptchaToken;
 * `ready` gates the submit button. Tokens are single-use, so call `reset()`
 * after any failed submit that sent one.
 */
export function useRecaptcha() {
  const enabled = env.recaptcha.enabled;
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  return {
    enabled,
    token: enabled ? (token ?? '') : NO_CAPTCHA,
    ready: !enabled || !!token,
    reset: () => {
      if (!enabled) return;
      setToken(null);
      setRound((n) => n + 1);
    },
    widget: enabled ? (
      <RecaptchaWidget key={round} onChange={setToken} />
    ) : null,
  };
}
