import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  clampSeek,
  CROP_PX,
  formatTime,
  NO_START_MESSAGE,
  OFFLINE_MESSAGE,
  PLAYER_VARS,
  qualityOptions,
  SLOW_LOAD_MESSAGE,
  YouTubePlayer,
  youTubeErrorMessage,
} from './youtube-player';

/** A stand-in for the YouTube IFrame API that records what the app asks of it. */
function installFakeYouTube() {
  const state = { time: 0, duration: 300, qualities: [] as string[] };
  const player = {
    getCurrentTime: vi.fn(() => state.time),
    getDuration: vi.fn(() => state.duration),
    seekTo: vi.fn((t: number) => {
      state.time = t;
    }),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    setPlaybackRate: vi.fn(),
    getAvailableQualityLevels: vi.fn(() => state.qualities),
    setPlaybackQuality: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
    destroy: vi.fn(),
    loadModule: vi.fn(),
    unloadModule: vi.fn(),
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
    buffering: () => act(() => events.onStateChange?.({ data: 3 })),
    created: () => (window.YT!.Player as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
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

describe('qualityOptions', () => {
  it('offers everything when YouTube reports nothing', () => {
    expect(qualityOptions([]).map((q) => q.label)).toEqual(['Auto', '1080p', '720p', '480p', '360p', '240p']);
  });

  it('always keeps Auto and drops what the video lacks or we don’t know', () => {
    expect(qualityOptions(['hd720', 'tiny']).map((q) => q.label)).toEqual(['Auto', '720p']);
  });
});

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

describe('youTubeErrorMessage', () => {
  it('gives each YouTube error its own explanation, action and code', () => {
    expect(youTubeErrorMessage(2)).toMatch(/start and end times aren’t valid.*course team.*error 2/);
    expect(youTubeErrorMessage(5)).toMatch(/Your browser couldn’t play.*error 5.*another browser/);
    expect(youTubeErrorMessage(100)).toMatch(/no longer available.*error 100/);
    for (const code of [101, 150]) expect(youTubeErrorMessage(code)).toMatch(new RegExp(`error ${code}.*sign in or confirm you’re not a bot`));
    for (const code of [152, 153]) expect(youTubeErrorMessage(code)).toMatch(new RegExp(`error ${code}.*privacy extension`));
    expect(youTubeErrorMessage(999)).toMatch(/error 999.*another browser/);
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

  it('offers quality choices and asks YouTube for the one picked', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    const menu = screen.getByRole('button', { name: 'Video quality' });
    expect(menu).toHaveTextContent('Auto');
    await user.click(menu);
    const option = await screen.findByRole('menuitemradio', { name: '720p' });
    option.focus();
    await user.keyboard('{Enter}');
    expect(yt.player.setPlaybackQuality).toHaveBeenCalledWith('hd720');
    expect(menu).toHaveTextContent('720p');
  });

  it('lists only the qualities the video reports once it plays', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    yt.state.qualities = ['hd720', 'medium', 'auto'];
    yt.playing();
    await user.click(screen.getByRole('button', { name: 'Video quality' }));
    expect((await screen.findAllByRole('menuitemradio')).map((o) => o.textContent)).toEqual(['Auto', '720p', '360p']);
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

  it('says YouTube held the video back, not the connection, when Play gets no response', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const yt = installFakeYouTube();
      render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
      await yt.ready();
      fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
      await act(() => vi.advanceTimersByTimeAsync(8500));
      expect(screen.getByRole('alert')).toHaveTextContent(NO_START_MESSAGE);
      expect(screen.getByRole('alert')).not.toHaveTextContent(/connection/);
      // Once it does play, the notice goes away.
      await yt.playing();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a video that is buffering longer, and only then blames the connection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const yt = installFakeYouTube();
      render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
      await yt.ready();
      fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
      await yt.buffering();
      await act(() => vi.advanceTimersByTimeAsync(8500));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Still loading the video…');
      await act(() => vi.advanceTimersByTimeAsync(22000));
      expect(screen.getByRole('alert')).toHaveTextContent(SLOW_LOAD_MESSAGE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the browser is offline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const yt = installFakeYouTube();
      render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
      await yt.ready();
      fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
      await act(() => vi.advanceTimersByTimeAsync(8500));
      expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_MESSAGE);
    } finally {
      onLine.mockRestore();
      vi.useRealTimers();
    }
  });

  it('Try again recreates the player and starts it once ready', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await yt.error(5);
    expect(yt.created()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await yt.ready();
    expect(yt.created()).toBe(2);
    expect(yt.player.destroy).toHaveBeenCalled();
    expect(yt.player.playVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can show YouTube’s own message after a failure, and covers it again once playing', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    await yt.error(150);
    expect(screen.getByTestId('player-shield')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show YouTube’s message/ }));
    expect(screen.queryByTestId('player-shield')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/sign in or confirm you’re not a bot/);
    await yt.playing();
    expect(screen.getByTestId('player-shield')).toBeInTheDocument();
  });

  it('asks YouTube for whole-second start and end times', async () => {
    const yt = installFakeYouTube();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={12.6} end={90.2} allowSeekForward />);
    await yt.ready();
    expect(yt.vars()).toMatchObject({ start: 12, end: 91 });
  });

  it('keeps subtitles off by default and toggles them with the CC button', async () => {
    const yt = installFakeYouTube();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    expect(yt.vars()).toMatchObject({ cc_load_policy: 0 });
    await yt.playing();
    expect(yt.player.unloadModule).toHaveBeenCalledWith('captions');
    await user.click(screen.getByRole('button', { name: 'Turn subtitles on' }));
    expect(yt.player.loadModule).toHaveBeenCalledWith('captions');
    // Starting playback again doesn't switch them back off.
    yt.player.unloadModule.mockClear();
    await yt.pausedEvent();
    await yt.playing();
    expect(yt.player.unloadModule).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Turn subtitles off' }));
    expect(yt.player.unloadModule).toHaveBeenCalledWith('captions');
  });

  it('crops YouTube’s title row and logo off the top and bottom of the embed', async () => {
    const yt = installFakeYouTube();
    const { container } = render(<YouTubePlayer videoId="QJNwK2uJyGs" start={0} end={300} allowSeekForward />);
    await yt.ready();
    const host = container.querySelector('[style*="top"]') as HTMLElement;
    expect(host.style.top).toBe(`-${CROP_PX}px`);
    expect(host.style.bottom).toBe(`-${CROP_PX}px`);
    expect(host.parentElement).toHaveClass('overflow-hidden');
  });
});
