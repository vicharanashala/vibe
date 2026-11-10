import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, resetSession, signInStudent } from '@/test/session';

import { isSamagraCourse, SAMAGRA_COURSE_IDS } from './samagra-consent-text';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const lessonUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/${path.item.id}`;
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('Samagra consent notice', () => {
  it('only treats the listed Samagra courses as Samagra', () => {
    expect(isSamagraCourse('6aead87b1e0ff57dc1df4790')).toBe(true);
    expect(isSamagraCourse(enrollment.courseId)).toBe(false);
    expect(isSamagraCourse(undefined)).toBe(false);
  });

  it('keeps the research consent for other courses', async () => {
    renderApp(lessonUrl);
    expect(await screen.findByRole('heading', { name: /Ethical Consent/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /anonymized images and audio/ })).toBeInTheDocument();
  });

  it('shows the Samagra notice without a research checkbox and posts no research consent', async () => {
    const added = enrollment.courseId;
    (SAMAGRA_COURSE_IDS as Set<string>).add(added);
    try {
      const user = userEvent.setup();
      renderApp(lessonUrl);
      expect(await screen.findByRole('heading', { name: /Samagra: Proctoring and Data Notice/ })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /anonymized images and audio/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/research purposes/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: /I have read this notice/ }));
      await user.click(screen.getByRole('button', { name: 'Sign and continue' }));
      expect(api.POST).toHaveBeenCalledWith(CONSENT, {
        params: { path: { courseId: enrollment.courseId, versionId: enrollment.courseVersionId } },
        body: { signature: 'Asha Student', additionalImageConsent: false },
      });
    } finally {
      (SAMAGRA_COURSE_IDS as Set<string>).delete(added);
    }
  });
});
