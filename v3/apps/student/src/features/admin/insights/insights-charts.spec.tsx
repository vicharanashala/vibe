import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import { courseInsightsFixture } from '@/test/fixtures/studio/course-insights';

import { ActivityChart, EnrolmentsChart, StudyHeatmap } from './activity';
import { longDay } from './format';
import { Headline } from './headline';
import { biggestDrop, ModuleFunnel, ProgressBands } from './progress';

const f = courseInsightsFixture(30);
const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!;

describe('headline trends', () => {
  it('shows each figure with its change against the previous period', () => {
    wrap(<Headline headline={f.headline!} />);
    const finished = stat('Finished');
    expect(finished).toHaveTextContent('12');
    expect(within(finished).getByText('+4')).toBeInTheDocument();
    expect(within(finished).getByText(/Up 4 from the previous period/)).toBeInTheDocument();
    expect(finished.querySelector('[data-direction]')).toHaveAttribute('data-direction', 'up');
    expect(stat('Average progress')).toHaveTextContent('46%');
    expect(within(stat('Average progress')).getByText('+7 pts')).toBeInTheDocument();
  });

  it('treats a shorter time to finish as an improvement', () => {
    wrap(<Headline headline={f.headline!} />);
    const median = stat('Median time to finish');
    expect(median).toHaveTextContent('19 days');
    expect(median.querySelector('[data-direction]')).toHaveAttribute('data-direction', 'down');
    expect(median.querySelector('[data-direction]')?.className).toMatch(/emerald/);
  });

  it('shows no trend when the previous period has no data', () => {
    wrap(<Headline headline={{ ...f.headline!, finished: { current: 3, previous: null } }} />);
    const finished = stat('Finished');
    expect(finished).toHaveTextContent('3');
    expect(finished.querySelector('[data-direction]')).toBeNull();
  });
});

describe('activity', () => {
  it('summarises the busiest day and gives screen readers every day’s figures', () => {
    wrap(<ActivityChart daily={f.daily!} range={30} />);
    const chart = screen.getByRole('figure', { name: 'Daily activity' });
    expect(chart).toHaveAccessibleDescription(/of learning in the last 30 days\. Busiest day:/);
    const table = within(chart).getByRole('table', { name: 'Active students and learning hours per day' });
    expect(within(table).getAllByRole('row')).toHaveLength(31);
    expect(within(table).getByRole('columnheader', { name: 'Learning hours' })).toBeInTheDocument();
  });

  it('opens the day’s tooltip from the keyboard', async () => {
    const user = userEvent.setup();
    wrap(<ActivityChart daily={f.daily!} range={30} />);
    const surface = screen.getByRole('application');
    act(() => surface.focus());
    await user.keyboard('{ArrowRight}');
    // Focus selects the first day; ArrowRight moves to the second.
    const first = f.daily![1];
    await waitFor(() => {
      const tip = document.querySelector('.recharts-tooltip-wrapper');
      expect(tip).toHaveTextContent(longDay(first.day));
      expect(tip).toHaveTextContent(`Active students${first.activeLearners}`);
    });
  });

  it('counts new enrolments across the range', () => {
    wrap(<EnrolmentsChart daily={f.daily!} range={30} />);
    const total = f.daily!.reduce((s, d) => s + d.newEnrolments, 0);
    expect(screen.getByRole('figure', { name: 'New enrolments' })).toHaveAccessibleDescription(
      `${total} students joined in the last 30 days.`,
    );
  });

  it('shows a heatmap cell’s value in a tooltip when it gets keyboard focus', async () => {
    const user = userEvent.setup();
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    heatmap[0][20] = 3;
    heatmap[2][9] = 1;
    wrap(<StudyHeatmap heatmap={heatmap} />);
    expect(screen.getByRole('figure', { name: 'When students study' })).toHaveAccessibleDescription(
      'Busiest hour: Mondays 20:00–21:00 IST, with 3 h.',
    );
    const cell = screen.getByRole('button', { name: 'Monday 20:00: 3 h' });
    // Keyboard focus: tab into the grid, then move to the cell.
    await user.tab();
    act(() => cell.focus());
    expect(await screen.findByText('Monday 20:00: 3 h')).toBeInTheDocument();
  });
});

describe('progress', () => {
  it('draws the progress bands from the analytics', () => {
    wrap(<ProgressBands bands={f.progressBands!} />);
    const chart = screen.getByRole('figure', { name: 'Progress' });
    expect(chart).toHaveAccessibleDescription('12 students finished and 18 haven’t started, out of 240.');
    const rows = within(within(chart).getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      'Not started18',
      '1–24%44',
      '25–49%71',
      '50–74%63',
      '75–99%32',
      'Finished12',
    ]);
  });

  it('finds the biggest drop between modules', () => {
    expect(biggestDrop(f.funnel!)).toEqual({ from: 2, lost: 85 });
    expect(biggestDrop([{ reached: 10, completed: 10 }, { reached: 10, completed: 4 }])).toBeNull();
  });

  it('highlights and labels the module step that loses the most students', () => {
    wrap(<ModuleFunnel funnel={f.funnel!} />);
    expect(screen.getByTestId('funnel-drop')).toHaveTextContent('−85 between module 3 and module 4');
    expect(screen.getByRole('figure', { name: 'Module by module' })).toHaveAccessibleDescription(
      'The biggest drop is after “Building with tools”: 85 students finished it but haven’t reached “Evaluating outputs”.',
    );
  });
});
