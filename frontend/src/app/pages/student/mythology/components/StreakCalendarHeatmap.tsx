import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Grid, Flame, Snowflake, Skull, Check, Sparkles, 
  HelpCircle, ChevronLeft, ChevronRight, Trophy, Award, Shield, Zap, Info, Clock
} from 'lucide-react';
import { ActivityLog } from '../types';

interface StreakCalendarHeatmapProps {
  systemDate: string;
  logs: ActivityLog[];
  currentStreak: number;
  longestStreak: number;
  karmaPoints: number;
  activitiesLoggedToday: string[];
}

type CalendarType = 'monthly' | 'heatmap' | 'weekly';

export const StreakCalendarHeatmap: React.FC<StreakCalendarHeatmapProps> = ({
  systemDate,
  logs,
  currentStreak,
  longestStreak,
  karmaPoints,
  activitiesLoggedToday
}) => {
  const [activeTab, setActiveTab] = useState<CalendarType>('monthly');
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ date: string; logs: ActivityLog[] } | null>(null);

  // Parse system date
  const { year, month, day, monthName, yearStr } = useMemo(() => {
    try {
      const parts = systemDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      const name = dateObj.toLocaleString('en-US', { month: 'long' });
      return { year: y, month: m, day: d, monthName: name, yearStr: parts[0] };
    } catch (e) {
      return { year: 2026, month: 6, day: 10, monthName: 'July', yearStr: '2026' };
    }
  }, [systemDate]);

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, ActivityLog[]> = {};
    logs.forEach(log => {
      if (!map[log.date]) {
        map[log.date] = [];
      }
      map[log.date].push(log);
    });
    return map;
  }, [logs]);

  // Calendar calculation: Monthly Grid
  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayIndex = useMemo(() => {
    return new Date(year, month, 1).getDay();
  }, [year, month]);

  // Month days mapping
  const monthDays = useMemo(() => {
    const arr = [];
    // Pad initial empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      arr.push(null);
    }
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push(dateStr);
    }
    return arr;
  }, [year, month, daysInMonth, firstDayIndex]);

  // Calendar calculation: 15-week LeetCode-style Heatmap
  // We will build a list of columns. Each column represents a week of 7 days, starting 15 weeks ago.
  const heatmapWeeks = useMemo(() => {
    const weeksList = [];
    const sysDateObj = new Date(year, month, day);
    
    // Find Sunday of the week 15 weeks ago
    const startOffset = 15 * 7;
    const startDate = new Date(sysDateObj);
    startDate.setDate(sysDateObj.getDate() - startOffset);
    // Align with Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let w = 0; w < 16; w++) { // 16 columns of weeks
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (w * 7) + d);
        const formattedDate = currentDate.toISOString().split('T')[0];
        weekDays.push(formattedDate);
      }
      weeksList.push(weekDays);
    }
    return weeksList;
  }, [year, month, day]);

  // Weekly consistency ribbon (current 7 days)
  const weeklyDays = useMemo(() => {
    const list = [];
    const sysDateObj = new Date(year, month, day);
    // Go back to the Sunday of this week
    const currentDayOfWeek = sysDateObj.getDay();
    const sundayDate = new Date(sysDateObj);
    sundayDate.setDate(sysDateObj.getDate() - currentDayOfWeek);

    for (let i = 0; i < 7; i++) {
      const cur = new Date(sundayDate);
      cur.setDate(sundayDate.getDate() + i);
      list.push(cur.toISOString().split('T')[0]);
    }
    return list;
  }, [year, month, day]);

  // Determine the status type of a date
  const getDayStatus = (dateStr: string) => {
    if (!dateStr) return { type: 'empty' };

    const isFuture = dateStr > systemDate;
    const isToday = dateStr === systemDate;
    const dayLogs = logsByDate[dateStr] || [];
    const hasLogs = dayLogs.length > 0;

    // Check for explicit streak freeze activations (logged inside activityLogs with custom id)
    const hasFreeze = dayLogs.some(log => log.activityId.startsWith('freeze-active-') || log.activityId.startsWith('sim-freeze'));

    if (isFuture) {
      return { type: 'future', hasLogs, hasFreeze, logs: dayLogs };
    }

    if (isToday) {
      const todayLogged = activitiesLoggedToday.length > 0 || hasLogs;
      return { type: 'today', hasLogs: todayLogged, hasFreeze, logs: dayLogs };
    }

    if (hasFreeze) {
      return { type: 'frozen', hasLogs: false, hasFreeze: true, logs: dayLogs };
    }

    if (hasLogs) {
      return { type: 'completed', hasLogs: true, hasFreeze: false, logs: dayLogs };
    }

    // Past day with no logs and no freeze: it's a missed day
    // Wait, let's only count days that are within the current testing/learning timeframe
    // Simple rule: any day before systemDate that is within our simulated history (after "2026-07-06")
    const isPlatformHistory = dateStr >= '2026-07-06';
    if (isPlatformHistory) {
      return { type: 'missed', hasLogs: false, hasFreeze: false, logs: [] };
    }

    return { type: 'inactive', hasLogs: false, hasFreeze: false, logs: [] };
  };

  // LeetCode-style ranks/tiers
  const rankInfo = useMemo(() => {
    const totalActivities = logs.length;
    if (longestStreak >= 50 || karmaPoints >= 800) {
      return { name: "Rishi of the Repository", title: "Rishi", icon: "👑", color: "text-amber-400 border-amber-500/40 bg-amber-950/15" };
    }
    if (longestStreak >= 21 || karmaPoints >= 400) {
      return { name: "Guardian of the Banyan", title: "Guardian", icon: "🛡️", color: "text-purple-400 border-purple-500/40 bg-purple-950/15" };
    }
    if (longestStreak >= 7 || karmaPoints >= 150) {
      return { name: "Knight of Consistency", title: "Knight", icon: "⚔️", color: "text-indigo-400 border-indigo-500/40 bg-indigo-950/15" };
    }
    return { name: "Aspirant Neophyte", title: "Neophyte", icon: "🌱", color: "text-slate-400 border-slate-800 bg-slate-900/60" };
  }, [longestStreak, karmaPoints, logs]);

  const monthlyChallengeProgress = useMemo(() => {
    // Count days in current month with logged activities
    let activeDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (logsByDate[dateStr]?.length > 0) {
        activeDays++;
      }
    }
    const requiredDays = 7; // Require 7 days to unlock monthly consistency medal
    const percent = Math.min(100, Math.round((activeDays / requiredDays) * 100));
    return { activeDays, requiredDays, percent, unlocked: activeDays >= requiredDays };
  }, [year, month, daysInMonth, logsByDate]);

  return (
    <div 
      id="streak-calendar-heatmap-root" 
      className="bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mb-8"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header and Views Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-5 mb-6">
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-indigo-400" /> STARRY FOREST SANCTUARY
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-100 uppercase tracking-wider mt-1 flex items-center gap-2">
            Interactive Streak Calendar & Heatmap
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Visualize your daily habit status, toggle display types, and track LeetCode-style credentials.
          </p>
        </div>

        {/* View Selection Tab List */}
        <div className="flex bg-slate-900 border border-slate-850 p-1 rounded-xl self-end sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'monthly' 
                ? 'bg-indigo-600 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Month Grid
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'heatmap' 
                ? 'bg-indigo-600 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Heatmap
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'weekly' 
                ? 'bg-indigo-600 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Weekly Strip
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COMPONENT: The Selected Calendar Display */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Monthly Calendar View */}
          {activeTab === 'monthly' && (
            <div>
              {/* Calendar Control Row */}
              <div className="flex justify-between items-center mb-4.5 px-1">
                <span className="font-serif font-bold text-slate-200 text-sm tracking-wider uppercase">
                  {monthName} {yearStr}
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30 inline-block" /> Active</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500/20 border border-sky-500/30 inline-block" /> Frozen</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-950/40 border border-rose-900/30 inline-block" /> Missed</span>
                </div>
              </div>

              {/* Day Titles */}
              <div className="grid grid-cols-7 gap-2.5 text-center mb-2.5">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, i) => (
                  <span key={i} className="text-[10px] font-mono text-slate-500 uppercase font-semibold tracking-wider">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2.5">
                {monthDays.map((dateStr, idx) => {
                  if (!dateStr) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded-xl" />;
                  }

                  const dayNum = parseInt(dateStr.split('-')[2], 10);
                  const status = getDayStatus(dateStr);
                  const isCurrentDay = dateStr === systemDate;

                  // Define styling based on status
                  let cellStyle = "border bg-slate-900/10 border-slate-900 text-slate-600";
                  let badgeIcon = null;

                  if (status.type === 'completed') {
                    cellStyle = "bg-gradient-to-br from-emerald-950/40 to-indigo-950/40 border-emerald-500/30 text-emerald-400 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.04)]";
                    badgeIcon = <Flame className="w-3.5 h-3.5 text-emerald-400 fill-current animate-pulse absolute top-1 right-1" />;
                  } else if (status.type === 'frozen') {
                    cellStyle = "bg-sky-950/30 border-sky-500/30 text-sky-400 hover:border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.04)]";
                    badgeIcon = <Snowflake className="w-3.5 h-3.5 text-sky-400 absolute top-1 right-1" />;
                  } else if (status.type === 'missed') {
                    cellStyle = "bg-rose-950/15 border-rose-950/40 text-rose-500 hover:border-rose-500/50";
                    badgeIcon = <Skull className="w-3 h-3 text-rose-600/60 absolute top-1 right-1" />;
                  } else if (status.type === 'today') {
                    cellStyle = status.hasLogs
                      ? "bg-gradient-to-br from-emerald-950/50 to-indigo-950/50 border-amber-400/80 text-amber-300 font-bold shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20"
                      : "bg-slate-900/60 border-amber-400/50 text-slate-300 font-bold animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.1)]";
                    badgeIcon = status.hasLogs 
                      ? <Check className="w-3.5 h-3.5 text-amber-400 absolute top-1 right-1 font-black" />
                      : <div className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute top-1.5 right-1.5" />;
                  } else if (status.type === 'future') {
                    cellStyle = "border-slate-900 border-dashed bg-slate-950/20 text-slate-700 cursor-not-allowed";
                  } else if (status.type === 'inactive') {
                    cellStyle = "bg-slate-900/20 border-slate-900/40 text-slate-500 hover:border-slate-700";
                  }

                  return (
                    <motion.div
                      key={dateStr}
                      whileHover={{ scale: status.type !== 'future' ? 1.05 : 1 }}
                      onClick={() => {
                        if (status.type !== 'future') {
                          setSelectedDayDetail({ date: dateStr, logs: status.logs });
                        }
                      }}
                      className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${cellStyle}`}
                    >
                      <span className="text-xs font-mono font-bold">{dayNum}</span>
                      {badgeIcon}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LeetCode Contribution Heatmap View */}
          {activeTab === 'heatmap' && (
            <div>
              <div className="flex justify-between items-center mb-4 px-1">
                <span className="font-serif font-bold text-slate-200 text-sm tracking-wider uppercase">
                  LeetCode-style Yearly Heatmap (15-Week Timeline)
                </span>
                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded bg-slate-900/60 border border-slate-950" />
                  <div className="w-2.5 h-2.5 rounded bg-emerald-950/40 border border-emerald-900/30" />
                  <div className="w-2.5 h-2.5 rounded bg-emerald-800/40 border border-emerald-600/40" />
                  <div className="w-2.5 h-2.5 rounded bg-emerald-500/50 border border-emerald-400/50" />
                  <span>More</span>
                </div>
              </div>

              {/* Heatmap Grid Wrapper (Horizontal Scrollable) */}
              <div className="bg-slate-950 border border-slate-900 p-4.5 rounded-2xl overflow-x-auto scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                <div className="flex gap-1 min-w-[500px]">
                  {/* Day Names Indicator Column */}
                  <div className="flex flex-col justify-between text-[9px] font-mono text-slate-500 pr-2 h-24 uppercase select-none font-bold">
                    <span>Su</span>
                    <span>Tu</span>
                    <span>Th</span>
                    <span>Sa</span>
                  </div>

                  {/* Weeks Columns */}
                  {heatmapWeeks.map((week, wIdx) => (
                    <div key={`week-${wIdx}`} className="flex flex-col gap-1 h-24 justify-between">
                      {week.map((dateStr) => {
                        const status = getDayStatus(dateStr);
                        const isToday = dateStr === systemDate;
                        const totalLogs = status.logs?.length || 0;

                        // Density-based shading
                        let colorClass = "bg-slate-900 border-slate-950/40";
                        if (isToday) {
                          colorClass = activitiesLoggedToday.length > 0 
                            ? "bg-amber-500 border-amber-400" 
                            : "bg-slate-800 border-amber-400/50 animate-pulse";
                        } else if (status.type === 'frozen') {
                          colorClass = "bg-sky-500/40 border-sky-400/30";
                        } else if (status.type === 'missed') {
                          colorClass = "bg-rose-950/30 border-rose-900/20";
                        } else if (totalLogs >= 3) {
                          colorClass = "bg-emerald-500 border-emerald-400";
                        } else if (totalLogs >= 2) {
                          colorClass = "bg-emerald-700/80 border-emerald-500/50";
                        } else if (totalLogs >= 1) {
                          colorClass = "bg-emerald-950/80 border-emerald-900/60";
                        }

                        return (
                          <div
                            key={dateStr}
                            onClick={() => {
                              if (dateStr <= systemDate) {
                                setSelectedDayDetail({ date: dateStr, logs: status.logs });
                              }
                            }}
                            className={`w-2.5 h-2.5 rounded-sm border cursor-pointer hover:scale-125 hover:z-10 transition-all ${colorClass}`}
                            title={`${dateStr}: ${totalLogs} activities completed ${status.type === 'frozen' ? '(Streak Frozen)' : ''}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Weekly Consistency Ribbon View */}
          {activeTab === 'weekly' && (
            <div>
              <div className="flex justify-between items-center mb-4.5 px-1">
                <span className="font-serif font-bold text-slate-200 text-sm tracking-wider uppercase">
                  Weekly Consistency Ribbon
                </span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest">7-Day Rolling Progress</span>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {weeklyDays.map((dateStr, idx) => {
                  const status = getDayStatus(dateStr);
                  const isToday = dateStr === systemDate;
                  const dateObj = new Date(dateStr + 'T12:00:00');
                  const dayName = dateObj.toLocaleString('en-US', { weekday: 'short' });
                  const dayNum = dateObj.getDate();

                  let displayBg = "bg-slate-900/30 border-slate-900 text-slate-500";
                  let itemIcon = null;

                  if (status.type === 'completed') {
                    displayBg = "bg-gradient-to-br from-emerald-950/40 to-indigo-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                    itemIcon = <Flame className="w-5 h-5 text-emerald-400 fill-current animate-pulse mt-2" />;
                  } else if (status.type === 'frozen') {
                    displayBg = "bg-sky-950/30 border-sky-500/30 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.05)]";
                    itemIcon = <Snowflake className="w-5 h-5 text-sky-400 mt-2" />;
                  } else if (status.type === 'missed') {
                    displayBg = "bg-rose-950/15 border-rose-950/30 text-rose-500";
                    itemIcon = <Skull className="w-4 h-4 text-rose-600/60 mt-2.5" />;
                  } else if (status.type === 'today') {
                    displayBg = status.hasLogs
                      ? "bg-gradient-to-br from-emerald-950/50 to-indigo-950/50 border-amber-400 text-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                      : "bg-slate-900/60 border-amber-400/50 text-slate-300 font-bold animate-pulse";
                    itemIcon = status.hasLogs
                      ? <Check className="w-5 h-5 text-amber-400 mt-2 font-black" />
                      : <div className="w-2.5 h-2.5 bg-amber-400 rounded-full mt-3.5 animate-ping" />;
                  } else if (status.type === 'future') {
                    displayBg = "border-slate-900 border-dashed bg-slate-950/10 text-slate-700";
                    itemIcon = <HelpCircle className="w-4 h-4 text-slate-800 mt-2.5" />;
                  }

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (status.type !== 'future') {
                          setSelectedDayDetail({ date: dateStr, logs: status.logs });
                        }
                      }}
                      className={`border rounded-2xl p-3 flex flex-col items-center justify-between min-h-[105px] cursor-pointer hover:border-slate-600 transition-all ${displayBg}`}
                    >
                      <div className="text-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold block opacity-60">{dayName}</span>
                        <span className="text-base font-mono font-black block mt-0.5">{dayNum}</span>
                      </div>
                      {itemIcon}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day details Drawer (Shown when clicking a day) */}
          <AnimatePresence>
            {selectedDayDetail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4.5 mt-2 relative overflow-hidden"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Study Logs for {selectedDayDetail.date}
                  </span>
                  <button 
                    onClick={() => setSelectedDayDetail(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {selectedDayDetail.logs.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-500 italic font-mono">No active logs registered on this day.</p>
                    {selectedDayDetail.date < systemDate && !selectedDayDetail.logs.some(l => l.activityId.startsWith('freeze-active-')) && (
                      <span className="text-[10px] text-rose-500/80 font-mono mt-1 block uppercase tracking-wider font-semibold">
                        ⚠️ Gaps of Absence Detected: Streak was broken or frozen.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {selectedDayDetail.logs.map((log, lIdx) => (
                      <div key={lIdx} className="bg-slate-950/70 border border-slate-900 p-2.5 rounded-xl flex justify-between items-center text-xs font-mono">
                        <div>
                          <p className="text-slate-200 font-bold font-sans">{log.activityName}</p>
                          <span className="text-[9px] text-slate-500 uppercase mt-0.5 block">{log.activityType} • {log.timestamp}</span>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-bold">
                          Verified Check
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COMPONENT: LeetCode-style Milestone Achievements Board */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Rank and League Shield */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider font-bold">LeetCode League Rank</span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 px-2 py-0.5 rounded font-mono font-bold">
                  Level {currentStreak >= 30 ? 'Knight-Master' : 'Aspirant'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-md">
                  {rankInfo.icon}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 font-sans">{rankInfo.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Consecutive presence validated</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-950/80">
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1.5">
                <span>Core Grit Index</span>
                <span>{longestStreak} / 100 Days</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((longestStreak / 100) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* LeetCode Monthly Challenge Badge */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider font-bold">Monthly Challenge Medal</span>
              <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-widest">JULY 2026</span>
            </div>

            <div className="flex items-center gap-4.5 mb-4">
              <div className="relative shrink-0">
                {/* Rotating Glowing Badge Border for Unlocked */}
                {monthlyChallengeProgress.unlocked ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-4px] rounded-full border border-dashed border-amber-400/50 z-0"
                  />
                ) : null}
                <div className={`w-14 h-14 rounded-full bg-slate-950 border flex items-center justify-center z-10 relative ${
                  monthlyChallengeProgress.unlocked 
                    ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                    : 'border-slate-800 grayscale opacity-40'
                }`}>
                  <Trophy className={`w-7 h-7 ${monthlyChallengeProgress.unlocked ? 'text-amber-400 fill-current animate-pulse' : 'text-slate-500'}`} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-200 font-sans uppercase tracking-wider">
                  {monthlyChallengeProgress.unlocked ? '🏆 July Challenger Badge' : '🔒 July Consistency Badge'}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono leading-relaxed mt-1">
                  Complete {monthlyChallengeProgress.requiredDays} study days in July.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-900 p-3 rounded-xl">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1.5">
                <span>Active Days: {monthlyChallengeProgress.activeDays} / {monthlyChallengeProgress.requiredDays}</span>
                <span>{monthlyChallengeProgress.percent}%</span>
              </div>
              <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${monthlyChallengeProgress.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Special LeetCode-style Milestones Checklist */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider font-bold block mb-3.5">LeetCode Milestones Check</span>
            <div className="space-y-2.5">
              {[
                { label: "Seeker's Flame (3 Days)", reached: currentStreak >= 3 },
                { label: "Royal Pathfinder (7 Days)", reached: currentStreak >= 7 },
                { label: "Riddle Solver (14 Days)", reached: currentStreak >= 14 },
                { label: "Vow Shield (30 Days)", reached: currentStreak >= 30 }
              ].map((ms, mIdx) => (
                <div key={mIdx} className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      ms.reached 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                        : 'border-slate-800 bg-slate-950'
                    }`}>
                      {ms.reached && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span className={ms.reached ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{ms.label}</span>
                  </span>
                  <span className={`text-[10px] font-bold ${ms.reached ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {ms.reached ? 'Unchained' : 'Locked'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
