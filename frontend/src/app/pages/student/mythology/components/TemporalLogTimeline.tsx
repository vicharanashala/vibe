import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, Calendar, Clock, Search, Filter, ShieldCheck, 
  Sparkles, Star, Map, Grid, Info, Trash2, Check, RefreshCw,
  BookOpen, HelpCircle, ArrowRight, Play, Volume2, VolumeX
} from 'lucide-react';

interface LogItem {
  activityId: string;
  activityName: string;
  activityType: string;
  points: number;
  date: string;
  timestamp: string;
  conceptNote?: string; // Optional notes or revision question
}

interface TemporalLogTimelineProps {
  logs: LogItem[];
  systemDate: string;
  onClearLogs?: () => void;
  onNotify: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  onChangeState: React.Dispatch<React.SetStateAction<any>>;
}

export const TemporalLogTimeline: React.FC<TemporalLogTimelineProps> = ({
  logs,
  systemDate,
  onClearLogs,
  onNotify,
  onChangeState
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [isMeditating, setIsMeditating] = useState(false);
  const [meditationText, setMeditationText] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Play custom synthesized sounds
  const playSound = (soundType: 'select' | 'complete' | 'meditation') => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (soundType === 'select') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now); // E4
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.12); // A4
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.25);
      } else if (soundType === 'complete') {
        // Triumphant crystal chime
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C major chord
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.06 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.45);
        });
      } else if (soundType === 'meditation') {
        // Slow peaceful cosmic drone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now); // A2 drone
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 1.8);
      }
    } catch (err) {
      console.warn("Sound block:", err);
    }
  };

  // Filter and search items
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.activityName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.activityType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || log.activityType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getLogColorAndIcon = (type: string) => {
    switch (type) {
      case 'spaced-rep':
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          badge: 'indigo',
          glow: 'shadow-[0_0_15px_rgba(99,102,241,0.25)]',
          label: 'Spaced Repetition'
        };
      case 'quiz':
        return {
          bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
          badge: 'sky',
          glow: 'shadow-[0_0_15px_rgba(14,165,233,0.25)]',
          label: 'Concept Quiz'
        };
      case 'video':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'emerald',
          glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
          label: 'Scroll Study'
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          badge: 'slate',
          glow: 'shadow-none',
          label: 'Vow Action'
        };
    }
  };

  // Handle study meditation on a logged activity to earn +5 KP
  const handleMeditationSubmit = () => {
    if (!meditationText.trim() || !selectedLog) return;
    
    onChangeState((prev: any) => ({
      ...prev,
      karmaPoints: prev.karmaPoints + 5,
      logs: prev.logs.map((item: any) => 
        item.activityId === selectedLog.activityId 
          ? { ...item, conceptNote: meditationText }
          : item
      )
    }));

    playSound('complete');
    onNotify(`🔮 Contemplation complete! Earned +5 KP for revising "${selectedLog.activityName}".`, 'success');
    
    // Update local selected log state
    setSelectedLog(prev => prev ? { ...prev, conceptNote: meditationText } : null);
    setIsMeditating(false);
    setMeditationText('');
  };

  return (
    <div 
      id="temporal-log-root" 
      className="bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mb-6"
    >
      {/* Visual background atmospheric elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/5 via-purple-500/0 to-transparent pointer-events-none" />

      {/* Title & Filters Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border-b border-slate-900 pb-5 mb-6">
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Chronicles Timeline
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-100 uppercase tracking-wider mt-1">
            Temporal Log of Presence
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Your footprints of focus across the sacred timelines of King Vikram.
          </p>
        </div>

        {/* Dynamic Controls Row */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Quick Audio Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            title="Toggle Timeline Soundscapes"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>

          {/* View Switchers */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => { setViewMode('timeline'); playSound('select'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'timeline' 
                  ? 'bg-indigo-600 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" /> Path
            </button>
            <button
              onClick={() => { setViewMode('grid'); playSound('select'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-indigo-600 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          {/* Reset Logs */}
          {onClearLogs && logs.length > 0 && (
            <button
              onClick={() => {
                onClearLogs();
                onNotify("✨ Temporal timelines purified. All history logs archived.", "info");
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-900/60 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5"
              title="Purge Temporal Logs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purge Logs
            </button>
          )}
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-slate-900/40 border border-slate-900 p-3 rounded-2xl">
        {/* Search Input */}
        <div className="md:col-span-7 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chronicles (e.g. 'hooks', 'Dharma', 'quiz')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 rounded-xl pl-9 pr-4 py-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/30"
          />
        </div>

        {/* Type Filter Select */}
        <div className="md:col-span-5 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); playSound('select'); }}
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/30"
          >
            <option value="all">All Chronicles</option>
            <option value="spaced-rep">Spaced Repetition</option>
            <option value="quiz">Concept Quizzes</option>
            <option value="video">Scroll Studies</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-950/40 border border-dashed border-slate-900 rounded-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-600 mb-4 animate-pulse">
            <History className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-300 font-sans">
            {logs.length === 0 
              ? "The Cosmic Chronicles are silent." 
              : "No logs found matching those filters."}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1 max-w-sm leading-relaxed">
            {logs.length === 0 
              ? "Log study hours, take a royal riddle quiz, or fulfill spaced rep items to forge Vikram's path."
              : "Clear search query or select 'All Chronicles' to see previous records."}
          </p>
        </div>
      ) : (
        <>
          {/* VIEW MODE: Path of the King (Immersive Vertical / Horizontal Timeline) */}
          {viewMode === 'timeline' && (
            <div className="relative pl-6 sm:pl-10 border-l-2 border-indigo-500/20 py-2 flex flex-col gap-6">
              {filteredLogs.map((log, index) => {
                const style = getLogColorAndIcon(log.activityType);
                const isSelected = selectedLog?.activityId === log.activityId;

                return (
                  <motion.div
                    key={log.activityId || index}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                  >
                    {/* Glowing timeline node pin */}
                    <div 
                      onClick={() => { setSelectedLog(log); playSound('select'); }}
                      className={`absolute -left-[31px] sm:-left-[47px] top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 bg-slate-950 flex items-center justify-center cursor-pointer transition-all z-10 ${
                        isSelected 
                          ? 'border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.5)] scale-110' 
                          : 'border-slate-800 hover:border-slate-500 hover:scale-105'
                      }`}
                      title="Click to view details & meditate"
                    >
                      <span className={`text-[10px] font-mono font-bold ${style.bg.split(' ')[2]}`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* Timeline Log Card */}
                    <div 
                      onClick={() => { setSelectedLog(log); playSound('select'); }}
                      className={`cursor-pointer border rounded-2xl p-4.5 transition-all bg-slate-900/30 hover:bg-slate-900/50 ${
                        isSelected 
                          ? 'border-indigo-500/40 bg-slate-900/70 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                          : 'border-slate-900 hover:border-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`text-[9px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold tracking-wider ${style.bg}`}>
                            {style.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {log.timestamp}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-slate-950 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                            +{log.points} KP Awarded
                          </span>
                          <span className="text-[9px] bg-slate-950 text-slate-500 border border-slate-900 px-2 py-0.5 rounded font-mono">
                            Verified
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-100 font-sans">
                        {log.activityName}
                      </h4>

                      {/* Concept note or revision detail if exists */}
                      {log.conceptNote ? (
                        <div className="mt-3 bg-slate-950/70 border border-indigo-500/10 p-3 rounded-xl">
                          <span className="text-[8px] font-mono text-indigo-400 font-bold block uppercase tracking-widest mb-1">
                            🧠 Contemplated Wisdom Note:
                          </span>
                          <p className="text-xs text-slate-300 italic font-sans leading-relaxed">
                            "{log.conceptNote}"
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2.5 text-[10px] font-mono text-slate-500 flex items-center gap-1 group-hover:text-slate-400 transition-colors">
                          <Info className="w-3.5 h-3.5" /> Click this timeline node to meditate or revise and claim bonus Karma!
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE: Bento Cards Grid */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLogs.map((log, index) => {
                const style = getLogColorAndIcon(log.activityType);
                const isSelected = selectedLog?.activityId === log.activityId;

                return (
                  <motion.div
                    key={log.activityId || index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.04 }}
                    onClick={() => { setSelectedLog(log); playSound('select'); }}
                    className={`cursor-pointer border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all bg-slate-900/30 hover:bg-slate-900/60 ${
                      isSelected 
                        ? 'border-indigo-500 bg-slate-900/70 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                        : 'border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider ${style.bg}`}>
                          {log.activityType.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {log.timestamp}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed">
                        {log.activityName}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-900/80 pt-3 mt-auto">
                      <span className="text-[10px] text-slate-400 font-mono">
                        📅 {log.date}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold bg-slate-950 border border-emerald-500/10 px-2 py-0.5 rounded">
                        +{log.points} KP
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Interactive Meditation Panel / Log Drawer (Shown when a log item is clicked) */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed inset-x-0 bottom-0 md:bottom-6 md:inset-x-auto md:right-6 md:w-[380px] bg-slate-950 border-t md:border border-slate-900 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] md:rounded-3xl p-6 z-50 text-slate-200 backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-900 pb-3 mb-4.5">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Log Contemplation
              </span>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-200 font-mono font-bold p-1 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Selected item metadata */}
            <div className="mb-4">
              <span className="text-[8px] font-mono text-slate-500 uppercase">Chronicle Target</span>
              <h4 className="text-sm font-bold text-slate-100 font-sans mt-0.5">{selectedLog.activityName}</h4>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-2">
                <span>📅 {selectedLog.date}</span>
                <span>•</span>
                <span>⏰ {selectedLog.timestamp}</span>
              </div>
            </div>

            {/* Note Display / Meditation area */}
            {selectedLog.conceptNote ? (
              <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4.5 mb-5">
                <span className="text-[9px] font-mono text-indigo-300 font-bold block uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-indigo-400 fill-current" /> Retained Wisdom:
                </span>
                <p className="text-xs text-slate-200 italic font-sans leading-relaxed">
                  "{selectedLog.conceptNote}"
                </p>
                <div className="mt-4 border-t border-indigo-950 pt-3 text-[9px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> You successfully claimed the +5 KP study revision blessing!
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 mb-5">
                <h5 className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Revise & Claim Blessing (+5 KP)
                </h5>
                <p className="text-xs text-slate-400 font-mono leading-relaxed mb-3">
                  Write down one key concept, core formula, or habit takeaway you learned or practiced during this session to receive a +5 KP boost!
                </p>

                {isMeditating ? (
                  <div className="flex flex-col gap-2.5">
                    <textarea
                      value={meditationText}
                      onChange={(e) => setMeditationText(e.target.value)}
                      placeholder="Write your study takeaways here..."
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 rounded-xl p-3 text-xs font-mono h-24 focus:outline-none focus:border-indigo-500/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsMeditating(false)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-mono font-bold py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleMeditationSubmit}
                        disabled={!meditationText.trim()}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-slate-100 text-xs font-mono font-bold py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> SUBMIT NOTE
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsMeditating(true); playSound('meditation'); }}
                    className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 hover:text-indigo-200 text-xs font-mono font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> BEGIN CONTEMPLATION
                  </button>
                )}
              </div>
            )}

            {/* Footer actions */}
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono py-2 px-4 rounded-xl hover:text-slate-200 transition-all cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
