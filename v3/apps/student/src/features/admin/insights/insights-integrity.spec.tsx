import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { courseInsightsFixture } from '@/test/fixtures/studio/course-insights';

import { ProctoringInsights, StudyModeSplit } from './proctoring';

const f = courseInsightsFixture(7);

describe('proctoring', () => {
  it('charts incidents per 100 learning hours by type, and the share of students with any', () => {
    render(<ProctoringInsights proctoring={f.proctoring!} range={7} />);
    const chart = screen.getByRole('figure', { name: 'Proctoring' });
    expect(chart).toHaveAccessibleDescription(
      '38% of students had at least one incident in the last 7 days. Most common: no face.',
    );
    const table = within(chart).getByRole('table', { name: 'Incidents per 100 learning hours, by day and type' });
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Day',
      'No face',
      'Voice heard',
      'Several faces',
      'Blurry camera',
    ]);
    const first = within(table).getAllByRole('row')[1];
    expect(first).toHaveTextContent(String(f.proctoring!.daily[0].per100Hours.NO_FACE));
  });

  it('opens a day’s breakdown from the keyboard', async () => {
    const user = userEvent.setup();
    render(<ProctoringInsights proctoring={f.proctoring!} range={7} />);
    act(() => screen.getByRole('application').focus());
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.querySelector('.recharts-tooltip-wrapper')).toHaveTextContent('per 100 h'));
  });

  it('says proctoring is off instead of drawing an empty chart', () => {
    render(<ProctoringInsights proctoring={{ checksOn: false, daily: [], shareWithIncident: 0 }} range={30} />);
    expect(screen.getByRole('figure', { name: 'Proctoring' })).toHaveAccessibleDescription(
      'Proctoring is off for this course, so there are no incidents to show.',
    );
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('groups the rarest types as Other when there are more than five', () => {
    const per100Hours = { NO_FACE: 9, VOICE_DETECTION: 7, MULTIPLE_FACES: 5, BLUR_DETECTION: 3, FOCUS: 2, PASTE_ATTEMPTED: 1 };
    render(<ProctoringInsights proctoring={{ checksOn: true, daily: [{ day: '2026-11-17', per100Hours }], shareWithIncident: 0.1 }} range={7} />);
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent);
    expect(headers).toEqual(['Day', 'No face', 'Voice heard', 'Several faces', 'Blurry camera', 'Other']);
    const cells = within(within(screen.getByRole('table')).getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['9', '7', '5', '3', '3']);
  });
});

describe('study mode', () => {
  it('shows how many use strict only, study only or both, in words as well as colour', () => {
    render(<StudyModeSplit studyMode={f.studyMode!} />);
    const panel = screen.getByRole('figure', { name: 'Study mode and strict mode' });
    expect(panel).toHaveAccessibleDescription('81 students have used study mode; 72 use both.');
    const items = within(panel).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Strict mode only141', 'Both72', 'Study mode only9']);
  });
});
