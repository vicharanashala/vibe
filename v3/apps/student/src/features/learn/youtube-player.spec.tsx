import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clampSeek, formatTime, PLAYER_VARS, YouTubePlayer, youTubeErrorMessage } from './youtube-player';

/** A stand-in for the YouTube IFrame API that records what the app asks of it. */
function installFakeYouTube() {
  const state = { time: 0, duration: 300 };
  const player = {
    getCurrentTime: vi.fn(() => state.time),
    getDuration: vi.fn(() => state.duration),
    seekTo: vi.fn((t: number) => {
      state.time = t;
    }),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    setPlaybackRate: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
    destroy: vi.fn(),
  };
  let events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void } = {};
  let playerVars: Record<string, unknown> = {};
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: vi.fn(function (_el: HTMLElement, opts: { playerVars: Record<string, unknown>; events: typeof events }) {
      playerVars = opts.playerVars;
      events = opts.events;
      return player;
    }) as never,
  };
  return {
    state,
    player,
    vars: () => playerVars,
    /** The player is created once the API promise resolves, so flush that first. */
    ready: async () => {
      await act(() => Promise.resolve());
      await act(() => events.onReady?.());
    },
    playing: () => act(() => events.onStateChange?.({ data: 1 })),
    pausedEvent: () => act(() => events.onStateChange?.({ data: 2 })),
    error: (code: number) => act(() => events.onError?.({ data: code })),
  };
}

afterEach(() => {
  delete window.YT;
});

describe('clampSeek', () => {
  const clip = { start: 10, end: 110, furthest: 40 };
  it('lets study mode seek anywhere in the clip, both ways', () => {
    expect(clampSeek(90, { ...clip, allowSeekForward: true })).toBe(90);
    expect(clampSeek(15, { ...clip, allowSeekForward: true })).toBe(15);
    expect(clampSeek(500, { ...clip, allowSeekForward: true })).toBe(110);
    expect(clampSeek(-5, { ...clip, allowSeekForward: true })).toBe(10);
  });

  it('holds strict mode at the furthest point watched, but always allows seeking back', () => {
    expect(clampSeek(90, { ...clip, allowSeekForward: false })).toBe(40);
    expect(clampSeek(20, { ...clip, allowSeekForward: false })).toBe(20);
  });

  it('treats a missing end as the whole video', () => {
    expect(clampSeek(900, { start: 0, end: 0, furthest: 0, allowSeekForward: true })).toBe(900);
  });
});

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

describe('YouTubePlayer', () => {
  it('turns YouTube’s own controls and links off and covers the embed', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    expect(yt.vars()).toMatchObject({ ...PLAYER_VARS, controls: 0, disablekb: 1, fs: 0, rel: 0 });
    expect(screen.getByTestId('player-shield')).toBeInTheDocument();
    // Not playing: the thumbnail and our play button hide YouTube's title and links.
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
    await yt.playing();
    expect(screen.queryAllByRole('button', { name: 'Play' })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('plays and pauses from its own controls and from a click on the video', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await user.click(screen.getAllByRole('button', { name: 'Play' })[0]);
    expect(yt.player.playVideo).toHaveBeenCalled();
    await yt.playing();
    fireEvent.click(screen.getByTestId('player-shield'));
    expect(yt.player.pauseVideo).toHaveBeenCalled();
  });

  it('skips forward and back freely in study mode', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await user.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(yt.player.seekTo).toHaveBeenLastCalledWith(10, true);
    await user.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(yt.player.seekTo).toHaveBeenLastCalledWith(20, true);
    await user.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    expect(yt.player.seekTo).toHaveBeenLastCalledWith(10, true);
  });

  it('can’t skip ahead of what was watched in strict mode, but can go back', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward={false} />);
    await yt.ready();
    expect(screen.getByRole('button', { name: 'Forward 10 seconds' })).toBeDisabled();
    // Watch up to 0:30, a couple of seconds per check (a sudden jump would be
    // a seek ahead, which strict mode snaps back).
    for (let t = 2; t <= 30; t += 2) {
      yt.state.time = t;
      await act(() => new Promise((r) => setTimeout(r, 260)));
    }
    await user.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    expect(yt.player.seekTo).toHaveBeenLastCalledWith(20, true);
    // Forward from 0:20 is allowed up to 0:30, the furthest point watched.
    await user.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
    expect(yt.player.seekTo).toHaveBeenLastCalledWith(30, true);
  });

  it('changes speed and mutes through its own controls', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(yt.player.mute).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Playback speed' }));
    const option = await screen.findByRole('menuitemradio', { name: '1.5×' });
    option.focus();
    await user.keyboard('{Enter}');
    expect(yt.player.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  it('won’t play while a proctoring block pauses the lesson', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward paused />);
    await yt.ready();
    for (const play of screen.getAllByRole('button', { name: 'Play' })) expect(play).toBeDisabled();
    fireEvent.click(screen.getByTestId('player-shield'));
    expect(yt.player.playVideo).not.toHaveBeenCalled();
  });

  it('says why when YouTube refuses to play, without revealing YouTube’s own screen', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await yt.error(150);
    expect(screen.getByRole('alert')).toHaveTextContent(youTubeErrorMessage(150));
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says the video didn’t start when Play gets no response', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const yt = installFakeYouTube();
      render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
      await yt.ready();
      fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
      await act(() => vi.advanceTimersByTimeAsync(8500));
      expect(screen.getByRole('alert')).toHaveTextContent('The video didn’t start');
      // Once it does play, the notice goes away.
      await yt.playing();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
