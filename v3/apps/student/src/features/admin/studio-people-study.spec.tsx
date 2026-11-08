import { screen, within } from '@testing-library/react';

import { renderApp } from '@/test/render-app';
import { resetSession } from '@/test/session';
import { SAMPLE, signInAdmin, studio } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

beforeEach(() => {
  resetSession();
  signInAdmin();
});

/** The cell of `row` under the column headed `heading`. */
function cellUnder(table: HTMLElement, row: HTMLElement, heading: string) {
  const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim());
  return within(row).getAllByRole('cell')[headers.indexOf(heading)];
}

describe('Studio People: study progress', () => {
  it('shows each student’s study percentage next to progress, and a dash for staff', async () => {
    renderApp(`/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=people`);
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Study' })).toBeInTheDocument();

    const [student, staff] = studio.enrollments.enrollments;
    const studentRow = (await within(table).findByText(student.user.email)).closest('tr')!;
    expect(cellUnder(table, studentRow, 'Study')).toHaveTextContent(`${student.studyProgress!.percentStudied}%`);
    expect(cellUnder(table, studentRow, 'Progress')).toHaveTextContent(`${student.progress}%`);

    const staffRow = within(table).getByText(staff.user.email).closest('tr')!;
    expect(cellUnder(table, staffRow, 'Study')).toHaveTextContent('—');
  });
});
