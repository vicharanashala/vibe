import React, { useState, useEffect, useRef } from 'react';
import { Award, Trophy, Shield, Sparkles, Volume2, Users, Search, Medal, Flame, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HallOfRecordsProps {
  currentStreak: number;
  longestStreak: number;
  karmaPoints: number;
  userName: string;
  avatar?: string;
  activeFlair?: string | null;
  logs?: any[];
  systemDate?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  title: string;
  streak: number;
  karma: number;
  isUser: boolean;
  avatarSeed: string;
  status: 'active' | 'ascended' | 'dormant';
}

export const HallOfRecords: React.FC<HallOfRecordsProps> = ({
  currentStreak,
  longestStreak,
  karmaPoints,
  userName,
  avatar = "🎓",
  activeFlair = "neophyte",
  logs = [],
  systemDate
}) => {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBountyClaim, setShowBountyClaim] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [vibeContributors, setVibeContributors] = useState<Omit<LeaderboardEntry, 'rank' | 'isUser'>[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // --- Karmic Growth Trajectory Chart Calculations ---
  // Generate list of last 14 dates ending at systemDate
  const dates: string[] = [];
  const baseDate = systemDate ? new Date(systemDate + 'T12:00:00') : new Date('2026-07-08T12:00:00');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Get karma points earned per log
  const getLogPoints = (log: any): number => {
    const name = log.activityName || '';
    if (name.includes('Sovereign Blessing') || name.includes('Bonus')) return 50;
    if (name.includes('Practice') || name.includes('Practice Revision')) return 15;
    if (name.includes('Doubt') || name.includes('Forum')) return 10;
    if (name.includes('Riddle') || name.includes('Betaal Riddle')) return 20;
    if (name.includes('Synchronized')) return 30;
    
    switch (log.activityType) {
      case 'quiz': return 15;
      case 'spaced-rep': return 10;
      case 'video': return 10;
      case 'question': return 10;
      case 'confusion': return 15;
      default: return 10;
    }
  };

  // Group log points by date
  const pointsByDate: Record<string, number> = {};
  dates.forEach(d => { pointsByDate[d] = 0; });

  logs.forEach(log => {
    if (log && log.date && pointsByDate[log.date] !== undefined) {
      pointsByDate[log.date] += getLogPoints(log);
    }
  });

  // Reconstruct cumulative backwards from current karmaPoints
  const cumulativeValues: Record<string, number> = {};
  let currentAccum = karmaPoints;
  cumulativeValues[dates[13]] = currentAccum;

  for (let i = 12; i >= 0; i--) {
    const tomorrowDate = dates[i + 1];
    const pointsEarnedTomorrow = pointsByDate[tomorrowDate];
    currentAccum = Math.max(0, currentAccum - pointsEarnedTomorrow);
    cumulativeValues[dates[i]] = currentAccum;
  }

  // Formulate data points for Recharts
  const chartData = dates.map(date => {
    const dateObj = new Date(date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      date,
      displayDate: formattedDate,
      cumulative: cumulativeValues[date],
      daily: pointsByDate[date]
    };
  });

  const maxCumulative = Math.max(...chartData.map(d => d.cumulative), 100);
  const maxDaily = Math.max(...chartData.map(d => d.daily), 10);

  // Legendary leaderboard entries (used as fallback or base)
  const baseEntries: Omit<LeaderboardEntry, 'rank' | 'isUser'>[] = [
    {
      name: "King Vikramaditya",
      title: "Sovereign of Ujjain",
      streak: 108,
      karma: 2500,
      avatarSeed: "👑",
      status: "ascended"
    },
    {
      name: "Sage Shantashil",
      title: "Crematorium Ascetic",
      streak: 90,
      karma: 1980,
      avatarSeed: "💀",
      status: "active"
    },
    {
      name: "Princess Vidyadhari",
      title: "High Scholar of Rhetoric",
      streak: 45,
      karma: 1120,
      avatarSeed: "💎",
      status: "active"
    },
    {
      name: "Scholar Vararuchi",
      title: "Grammarian of the Court",
      streak: 30,
      karma: 780,
      avatarSeed: "📜",
      status: "active"
    },
    {
      name: "Bhartrihari",
      title: "Sovereign Hermit Poet",
      streak: 15,
      karma: 420,
      avatarSeed: "✍️",
      status: "dormant"
    },
    {
      name: "Seeker Varahamihira",
      title: "Celestial Astrologer",
      streak: 7,
      karma: 180,
      avatarSeed: "🌌",
      status: "active"
    }
  ];

  // Fetch real contributors of Vibe from backend on load
  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => {
        if (!res.ok) throw new Error("Leaderboard route error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setVibeContributors(data);
        }
      })
      .catch(err => {
        console.warn("Could not fetch real Vibe contributors, using base entries:", err);
      });
  }, []);

  // Post the user's current score to the global in-memory leaderboard API
  useEffect(() => {
    if (userName && userName !== "Guest" && userName !== "vibeseeker") {
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          title: currentStreak >= 15 ? "Vow Master Seeker" : "Novice Chronicle Seeker",
          streak: Math.max(currentStreak, longestStreak),
          karma: karmaPoints,
          avatarSeed: avatar,
          status: currentStreak > 0 ? "active" : "dormant"
        })
      }).catch(err => console.warn("Failed to update global leaderboard", err));
    }
  }, [userName, currentStreak, longestStreak, karmaPoints, avatar]);

  // Dynamic user entry compiled with real metrics
  const userEntry: Omit<LeaderboardEntry, 'rank' | 'isUser'> = {
    name: userName,
    title: currentStreak >= 15 ? "Vow Master Seeker" : "Novice Chronicle Seeker",
    streak: Math.max(currentStreak, longestStreak),
    karma: karmaPoints,
    avatarSeed: avatar,
    status: currentStreak > 0 ? "active" : "dormant"
  };

  // Build sorted list including user
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // If we have real Vibe contributors, merge them with mythological baseline or display them!
    const baseline = vibeContributors.length > 0 ? vibeContributors : baseEntries;
    
    // Load local multi-user student profiles
    const localProfiles: Omit<LeaderboardEntry, 'rank' | 'isUser'>[] = [];
    try {
      const stored = localStorage.getItem('vibe_profiles');
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [name, pState] of Object.entries<any>(parsed)) {
          // Exclude the currently active user (we add them later to ensure fresh stats)
          if (name.toLowerCase() !== userName.toLowerCase()) {
            localProfiles.push({
              name,
              title: (pState.currentStreak || 0) >= 15 ? "Vow Master Seeker" : "Novice Chronicle Seeker",
              streak: Math.max(pState.currentStreak || 0, pState.longestStreak || 0),
              karma: pState.karmaPoints || 0,
              avatarSeed: pState.avatar || "🎓",
              status: (pState.currentStreak || 0) > 0 ? "active" : "dormant"
            });
          }
        }
      }
    } catch(e) {}

    // Exclude any names from baseline that are already in local profiles or are the current user
    const namesToExclude = [userName.toLowerCase(), ...localProfiles.map(p => p.name.toLowerCase())];
    const filteredBaseline = baseline.filter(item => !namesToExclude.includes(item.name.toLowerCase()));
    
    // Merge baseline, other local students, and current active user
    const list = [...filteredBaseline, ...localProfiles, userEntry];
    
    // Sort descending by streak, then by karma
    list.sort((a, b) => {
      if (b.streak !== a.streak) {
        return b.streak - a.streak;
      }
      return b.karma - a.karma;
    });

    // Assign ranking indexes
    const rankedList: LeaderboardEntry[] = list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      isUser: item.name.toLowerCase() === userName.toLowerCase()
    }));

    setLeaderboard(rankedList);
  }, [currentStreak, longestStreak, karmaPoints, userName, vibeContributors]);

  // Synthesize royal bells and trumpets when checking achievements
  const playSovereignFanfare = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      
      const playBellTone = (freq: number, start: number, duration: number, type: 'sine' | 'triangle' = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.08, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play major ascending royal chord progression (fanfare)
      playBellTone(261.63, now, 1.5, 'triangle');       // C4
      playBellTone(329.63, now + 0.15, 1.3, 'triangle');  // E4
      playBellTone(392.00, now + 0.3, 1.1, 'triangle');   // G4
      playBellTone(523.25, now + 0.45, 1.8, 'sine');     // C5 (Sparkle)
      playBellTone(659.25, now + 0.6, 1.5, 'sine');      // E5 (Triumph)
    } catch (e) {
      console.warn('Audio synthesis skipped:', e);
    }
  };

  const handleClaimBounty = () => {
    playSovereignFanfare();
    setShowBountyClaim(true);
  };

  // Filter list based on UI selection and search query
  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          entry.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || entry.status === 'active';
    return matchesSearch && matchesFilter;
  });

  const userRank = leaderboard.find(e => e.isUser)?.rank || 7;

  return (
    <div id="vikrams-hall-of-records-panel" className="bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Absolute gold-etched metallic borders */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-amber-600/30 via-yellow-400/20 to-amber-600/30" />

      {/* Background stardust glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header and description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
              <Trophy className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-serif font-bold tracking-wider text-slate-100 uppercase">
              Vikram's Hall of Records
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Legendary chronicle of consistent seekers who carry Vikram's lantern.
          </p>
        </div>

        {/* Claimable Sovereign Bounty button */}
        <button
          onClick={handleClaimBounty}
          className="bg-slate-900 hover:bg-slate-850 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 text-[10px] font-mono font-bold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          Sovereign Bounty
        </button>
      </div>

      {/* Interactive statistics strip for user */}
      <div className="grid grid-cols-3 gap-3 bg-slate-900/30 border border-slate-900/80 rounded-xl p-3.5 mb-6 text-center font-mono relative">
        <div className="absolute inset-y-0 right-1/3 w-[1px] bg-slate-900" />
        <div className="absolute inset-y-0 left-1/3 w-[1px] bg-slate-900" />
        
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Your Court Rank</span>
          <span className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
            <Medal className="w-3.5 h-3.5" /> #{userRank}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Top Record</span>
          <span className="text-sm font-bold text-slate-200 mt-0.5 block">
            {longestStreak} Days
          </span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Karmic Weight</span>
          <span className="text-sm font-bold text-indigo-400 mt-0.5 block">
            {karmaPoints} KP
          </span>
        </div>
      </div>

      {/* Karmic Growth Trajectory Chart */}
      <div className="bg-slate-900/20 border border-slate-900/80 rounded-xl p-4 mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-serif font-bold text-slate-200 tracking-wide uppercase">
              Karmic Growth Trajectory
            </h3>
          </div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Last 14 Days</span>
        </div>

        {/* Custom Responsive SVG Chart */}
        <div className="relative w-full">
          <svg 
            viewBox="0 0 600 180" 
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="colorKarma" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const yVal = 15 + ratio * 125;
              return (
                <line
                  key={i}
                  x1="45"
                  y1={yVal}
                  x2="580"
                  y2={yVal}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.4"
                />
              );
            })}

            {/* Y-Axis Labels */}
            {[0, 0.5, 1].map((ratio, i) => {
              const yVal = 180 - 25 - ratio * 125;
              const val = Math.round(ratio * maxCumulative);
              return (
                <text
                  key={i}
                  x="35"
                  y={yVal + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              );
            })}

            {/* Daily Gain Bars (Rendered below Cumulative lines) */}
            {chartData.map((d, i) => {
              const x = 45 + (i / 13) * 535;
              const barH = (d.daily / maxDaily) * 35;
              const y = 180 - 25 - barH;
              return (
                <rect
                  key={i}
                  x={x - 4}
                  y={y}
                  width="8"
                  height={barH}
                  fill="url(#barGradient)"
                  rx="1.5"
                  opacity={hoveredIndex === i ? "1" : "0.5"}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Cumulative Area & Line Path */}
            {(() => {
              const getX = (index: number) => 45 + (index / 13) * 535;
              const getCumulativeY = (val: number) => 180 - 25 - (val / maxCumulative) * 125;
              const linePath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getCumulativeY(d.cumulative).toFixed(1)}`).join(' ');
              const areaPath = `${linePath} L ${getX(13).toFixed(1)} ${180 - 25} L ${getX(0).toFixed(1)} ${180 - 25} Z`;

              return (
                <>
                  <path
                    d={areaPath}
                    fill="url(#colorKarma)"
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Glowing line overlay */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.15"
                  />
                </>
              );
            })()}

            {/* Interactive Circles and Vertical Hover Bars */}
            {chartData.map((d, i) => {
              const x = 45 + (i / 13) * 535;
              const y = 180 - 25 - (d.cumulative / maxCumulative) * 125;
              const isHovered = hoveredIndex === i;

              return (
                <g key={i}>
                  {/* Invisible broad column for easy hovering */}
                  <rect
                    x={x - 18}
                    y="10"
                    width="36"
                    height="145"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {/* Vertical Hover Guide Line */}
                  {isHovered && (
                    <line
                      x1={x}
                      y1="10"
                      x2={x}
                      y2="155"
                      stroke="#4f46e5"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.6"
                      pointerEvents="none"
                    />
                  )}

                  {/* Dot on the Cumulative line */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? "5" : "3.5"}
                    fill={isHovered ? "#818cf8" : "#6366f1"}
                    stroke="#1e1b4b"
                    strokeWidth="1.5"
                    pointerEvents="none"
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

            {/* X-Axis Labels (Show alternate labels to prevent overlap) */}
            {chartData.map((d, i) => {
              if (i % 2 !== 0 && i !== 13) return null; // Show every 2nd date and the last date
              const x = 45 + (i / 13) * 535;
              return (
                <text
                  key={i}
                  x={x}
                  y="172"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="7.5"
                  fontFamily="monospace"
                >
                  {d.displayDate}
                </text>
              );
            })}
          </svg>

          {/* Absolute Hover Tooltip Overlay */}
          <AnimatePresence>
            {hoveredIndex !== null && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute z-30 pointer-events-none"
                style={{
                  // Position relative to the container width (600px coordinates)
                  left: `${((45 + (hoveredIndex / 13) * 535) / 600) * 100}%`,
                  // Place tooltip above or below depending on cumulative value to avoid overlay
                  top: chartData[hoveredIndex].cumulative > maxCumulative * 0.6 ? '70px' : '15px',
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="bg-slate-950/95 border border-amber-500/30 rounded-xl p-2.5 shadow-2xl font-mono text-[9px] text-slate-300 min-w-[120px]">
                  <p className="text-amber-400 font-bold mb-1 border-b border-slate-800 pb-0.5 text-center">
                    {chartData[hoveredIndex].displayDate}
                  </p>
                  <div className="space-y-0.5 mt-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Total Karma:</span>
                      <span className="text-indigo-400 font-bold">{chartData[hoveredIndex].cumulative} KP</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Daily Gain:</span>
                      <span className="text-emerald-400 font-bold">+{chartData[hoveredIndex].daily} KP</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-5">
        <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-initial text-[10px] font-mono font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-950 text-amber-400 border border-slate-800 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All-Time Greats
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`flex-1 sm:flex-initial text-[10px] font-mono font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'active'
                ? 'bg-slate-950 text-amber-400 border border-slate-800 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active Seekers
          </button>
        </div>

        {/* Live Search bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chronicle seekers..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/30 transition-all font-mono"
          />
        </div>
      </div>

      {/* Rankings Leaderboard Grid */}
      <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
        {filteredLeaderboard.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8 italic font-mono">
            No chronicle seekers match your queries.
          </p>
        ) : (
          filteredLeaderboard.map((entry) => {
            const isTop3 = entry.rank <= 3;
            
            return (
              <div
                key={entry.name}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                  entry.isUser
                    ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                    : 'bg-slate-900/20 border-slate-900/80 hover:border-slate-800'
                }`}
              >
                {/* Gold shine accent on hovered top entries */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/[0.015] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold border ${
                    entry.rank === 1
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : entry.rank === 2
                      ? 'bg-slate-400/10 border-slate-400/30 text-slate-300'
                      : entry.rank === 3
                      ? 'bg-amber-700/10 border-amber-700/30 text-amber-600'
                      : 'bg-slate-950 border-slate-900 text-slate-500'
                  }`}>
                    {entry.rank}
                  </div>

                  {/* Avatar / Icon */}
                  <div className="flex-shrink-0 select-none">
                    {entry.avatarSeed.startsWith('http') ? (
                      <img 
                        src={entry.avatarSeed} 
                        className="w-7 h-7 rounded-full border border-slate-800 object-cover shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                        alt={entry.name} 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="text-lg">{entry.avatarSeed}</div>
                    )}
                  </div>

                  {/* Identity Details */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-serif font-bold ${
                        entry.isUser ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {entry.name}
                      </span>
                      {entry.isUser && (
                        <span className="text-[8px] bg-amber-500 text-slate-950 px-1 py-0.5 rounded font-mono font-bold uppercase">
                          YOU
                        </span>
                      )}
                      {entry.isUser && (() => {
                        const flairStyles: Record<string, { badgeText: string; className: string }> = {
                          neophyte: { badgeText: "🌱 Neophyte", className: "text-slate-400 border-slate-800 bg-slate-900/60" },
                          enlightened: { badgeText: "✨ The Enlightened", className: "text-amber-400 border-amber-500/30 bg-amber-950/10 shadow-[0_0_8px_rgba(245,158,11,0.2)]" },
                          sage: { badgeText: "👑 Sovereign Sage", className: "text-indigo-400 border-indigo-500/30 bg-indigo-950/10 shadow-[0_0_10px_rgba(99,102,241,0.2)] animate-pulse" },
                          companion: { badgeText: "💀 Betaal's Companion", className: "text-rose-400 border-rose-500/30 bg-rose-950/10 shadow-[0_0_12px_rgba(244,63,94,0.2)] font-serif" },
                          weaver: { badgeText: "🌀 Space-Time Weaver", className: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 border-cyan-500/20 bg-slate-950 font-bold" }
                        };
                        const currentFlair = flairStyles[activeFlair || "neophyte"] || flairStyles.neophyte;
                        return (
                          <span className={`text-[7.5px] border px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 leading-none ${currentFlair.className}`}>
                            {currentFlair.badgeText}
                          </span>
                        );
                      })()}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {entry.title}
                    </span>
                  </div>
                </div>

                {/* Score / Streak */}
                <div className="text-right flex items-center gap-4">
                  <div className="font-mono">
                    <span className="text-[9px] text-slate-500 uppercase block">Streak</span>
                    <span className="text-xs font-bold text-slate-200 flex items-center justify-end gap-1">
                      <Flame className={`w-3.5 h-3.5 fill-current ${entry.streak > 30 ? 'text-rose-500' : 'text-amber-500'}`} />
                      {entry.streak} Days
                    </span>
                  </div>
                  <div className="font-mono hidden sm:block">
                    <span className="text-[9px] text-slate-500 uppercase block">Karma</span>
                    <span className="text-xs font-semibold text-slate-400 block">
                      {entry.karma} KP
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sovereign Bounty Claims Overlay */}
      <AnimatePresence>
        {showBountyClaim && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden text-center"
            >
              {/* Corner metal plates */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-amber-500" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-amber-500" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-amber-500" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-amber-500" />

              <div className="flex justify-center mb-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full">
                  <Shield className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <span className="text-[9px] font-mono tracking-widest text-amber-500 uppercase font-semibold block mb-1">
                Imperial Court Decree
              </span>
              <h3 className="text-lg font-serif font-bold text-slate-100 mb-2">
                Sovereign Streak Bounty
              </h3>
              
              <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
                King Vikram rewards persistent seekers who preserve their daily vows of learning and active retrieval. Accumulate milestones to claim rare mythological badges!
              </p>

              {/* Requirement Cards */}
              <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-4 mb-4 text-left font-mono text-[11px] text-slate-300 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span>Novice Seeker (3+ Days):</span>
                  <span className={currentStreak >= 3 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {currentStreak >= 3 ? '✓ Cleared' : 'Locked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Adeled Scholar (14+ Days):</span>
                  <span className={currentStreak >= 14 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {currentStreak >= 14 ? '✓ Cleared' : 'Locked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Grand Vow Master (100+ Days):</span>
                  <span className={currentStreak >= 100 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {currentStreak >= 100 ? '✓ Cleared' : 'Locked'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowBountyClaim(false)}
                  className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 font-mono font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Return to Hall of Records
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
