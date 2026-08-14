import React, { useState, useEffect } from 'react';
import { Sparkles, SunDim, Flame, Eye, Heart, BookOpen, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserStreakState } from '../types';
import { audioSynthesizer } from '../utils/audioSynthesizer';

interface SovereignVowAltarProps {
  state: UserStreakState;
  onChangeState: React.Dispatch<React.SetStateAction<UserStreakState>>;
  onNotify: (message: string, type: 'success' | 'info' | 'badge') => void;
}

const ANCIENT_VOWS = [
  {
    id: 'vow-sun',
    title: 'Vow of the Golden Sun',
    quote: '“I shall pursue the day’s study before the shadows lengthen, ensuring the sacred light of wisdom never fades from my sight.”',
    directive: 'Complete any study scroll or practice before sunset.',
    type: 'Focus',
    color: 'from-amber-400 to-orange-500'
  },
  {
    id: 'vow-sentry',
    title: 'Vow of the Midnight Sentry',
    quote: '“Like the watchman at the gates of Vikram’s fortress, I will guard my daily habit timeline with fierce and unyielding vigilance.”',
    directive: 'Keep your streak alive. Avoid letting it decay.',
    type: 'Consistency',
    color: 'from-indigo-400 to-violet-500'
  },
  {
    id: 'vow-scholar',
    title: 'Vow of the Quiet Scholar',
    quote: '“I shall craft my learning in quiet sanctuary, letting my growing footprints speak for themselves in the great karmic ledger of time.”',
    directive: 'Log a focused session. Silence outer noise.',
    type: 'Wisdom',
    color: 'from-emerald-400 to-teal-500'
  },
  {
    id: 'vow-canopy',
    title: 'Vow of the Emerald Canopy',
    quote: '“I will rise above the weeds of idle distraction, spreading my leaves of attention toward the high stellar stars of master design.”',
    directive: 'Advance at least one course module in your learning map.',
    type: 'Growth',
    color: 'from-teal-400 to-emerald-500'
  },
  {
    id: 'vow-resolve',
    title: 'Vow of the Iron Resolve',
    quote: '“Though the trickster Betaal questions my resolve with endless riddles, my focus remains an unbent bow, aimed at eternal mastery.”',
    directive: 'Submit an answer to Betaal’s daily generated riddle.',
    type: 'Fortitude',
    color: 'from-rose-400 to-pink-500'
  }
];

export function SovereignVowAltar({ state, onChangeState, onNotify }: SovereignVowAltarProps) {
  const [currentVow, setCurrentVow] = useState(ANCIENT_VOWS[0]);
  const [isAttuned, setIsAttuned] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  // Pick a vow based on the day of the system date
  useEffect(() => {
    if (state.systemDate) {
      const dateNum = new Date(state.systemDate).getDate() || 0;
      const vowIndex = dateNum % ANCIENT_VOWS.length;
      setCurrentVow(ANCIENT_VOWS[vowIndex]);
      
      // Check if we already attuned to this vow today
      const savedAttuned = localStorage.getItem(`vow_attuned_${state.systemDate}`);
      setIsAttuned(savedAttuned === 'true');
    }
  }, [state.systemDate]);

  const handleAttune = () => {
    if (isAttuned) return;

    if (audioSynthesizer.getIsEnabled()) {
      audioSynthesizer.playBadgeUnlockChime();
    }

    // Spawn 15 sparkle particles for a gorgeous glow burst
    const newSparkles = Array.from({ length: 15 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      size: Math.random() * 12 + 6
    }));
    setSparkles(newSparkles);

    // Update state to add 10 Karma Points
    onChangeState(prev => {
      // Avoid logging multiple activities for attuning if they click fast
      const alreadyLogged = prev.activitiesLoggedToday.includes(`vow-attune-${state.systemDate}`);
      if (alreadyLogged) return prev;

      const updatedLogs = [...prev.logs];
      updatedLogs.unshift({
        date: prev.systemDate,
        activityId: `vow-attune-${state.systemDate}`,
        activityName: `Attuned to Daily Sovereign Vow: "${currentVow.title}"`,
        activityType: 'spaced-rep',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      });

      return {
        ...prev,
        karmaPoints: prev.karmaPoints + 10,
        activitiesLoggedToday: [...prev.activitiesLoggedToday, `vow-attune-${state.systemDate}`],
        logs: updatedLogs
      };
    });

    setIsAttuned(true);
    localStorage.setItem(`vow_attuned_${state.systemDate}`, 'true');
    onNotify(`✨ Attuned successfully to the "${currentVow.title}"! Thy karmic weight increases. (+10 KP)`, 'success');

    // Fade out sparkles after 2 seconds
    setTimeout(() => {
      setSparkles([]);
    }, 2000);
  };

  return (
    <div 
      id="sovereign-vow-altar-widget"
      className="relative bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-5 shadow-xl overflow-hidden group transition-all duration-300 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
    >
      {/* Background soft sun glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

      {/* Floating Sparkles Canvas */}
      <AnimatePresence>
        {sparkles.map((sp) => (
          <motion.div
            key={sp.id}
            initial={{ scale: 0, opacity: 1, y: 10 }}
            animate={{ scale: [1, 1.5, 0], opacity: [1, 0.8, 0], y: -50 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute pointer-events-none text-amber-400 z-20"
            style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
          >
            ✦
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase flex items-center gap-1.5">
          <SunDim className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
          Sovereign Altar of Vows
        </h3>
        <span className="text-[8px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold tracking-wider">
          DAILY ALIGNMENT
        </span>
      </div>

      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-slate-950/30 border border-indigo-500/5 group-hover:border-indigo-500/10 transition-all">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-gradient-to-r ${currentVow.color} text-slate-950`}>
              {currentVow.type}
            </span>
            <h4 className="text-xs font-serif font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
              {currentVow.title}
            </h4>
          </div>
          <p className="text-xs text-slate-300 italic font-sans leading-relaxed">
            {currentVow.quote}
          </p>
          <div className="mt-2 text-[10px] text-indigo-300 font-mono flex items-center gap-1">
            <Compass className="w-3 h-3 text-indigo-400" />
            <span>{currentVow.directive}</span>
          </div>
        </div>

        <button
          onClick={handleAttune}
          disabled={isAttuned}
          className={`w-full py-2 px-4 rounded-xl font-mono text-xs font-bold transition-all relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer ${
            isAttuned
              ? 'bg-slate-900/60 border border-slate-850 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95'
          }`}
        >
          {isAttuned ? (
            <span className="flex items-center gap-1 text-emerald-400">
              ✓ ATTUNED TO DECREE (+10 KP CLAIMED)
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ATTUNE TO SOVEREIGN DECREE (+10 KP)
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
