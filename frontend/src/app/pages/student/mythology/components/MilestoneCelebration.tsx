import React, { useEffect, useRef } from 'react';
import { Badge } from '../types';
import { BadgeSVG } from './BadgeCard';
import { Sparkles, Award, Shield, CheckCircle, Scroll } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MilestoneCelebrationProps {
  badge: Badge | null;
  onClose: () => void;
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({ badge, onClose }) => {
  const soundPlayedRef = useRef(false);

  // Play a beautiful, majestic procedural horn fanfare and sparkling resolution
  const playMilestoneFanfare = () => {
    if (soundPlayedRef.current) return;
    soundPlayedRef.current = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Part 1: Heavy Royal Horns (Triumphant chord rising: C4 -> E4 -> G4 -> C5)
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        
        // Slight lowpass filter to make it sound like an ancient horn
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 1.2);

        const delay = index * 0.12;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 1.3);
      });

      // Part 2: High Fairy Chime Arpeggio on resolution (1.0 second in)
      const chimeDelay = 0.8;
      const chimeNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5 to G6
      chimeNotes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const noteDelay = chimeDelay + (index * 0.05);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + noteDelay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + noteDelay + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + noteDelay);
        osc.stop(now + noteDelay + 0.6);
      });
    } catch (err) {
      console.warn("Milestone Audio blocked:", err);
    }
  };

  useEffect(() => {
    if (badge) {
      playMilestoneFanfare();
    } else {
      soundPlayedRef.current = false;
    }
  }, [badge]);

  if (!badge) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-hidden">
      {/* Immersive backdrop with deep gradient and slow blur */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Radiant celestial sun rays expanding outwards in background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Shimmering Golden Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -120, 0],
              x: [0, (Math.random() - 0.5) * 40, 0],
              opacity: [0, 0.8, 0],
              scale: [0.5, Math.random() * 1.5 + 0.5, 0.5]
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      {/* Main Gilded Frame Container */}
      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 120 }}
        className="relative bg-gradient-to-b from-slate-900 via-indigo-950/80 to-slate-950 border-2 border-amber-500/30 max-w-lg w-full rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.15)] flex flex-col items-center overflow-hidden"
      >
        {/* Intricate Corner Runes */}
        <div className="absolute top-3 left-3 text-[10px] font-serif text-amber-500/30 select-none">✦ 📜 ✦</div>
        <div className="absolute top-3 right-3 text-[10px] font-serif text-amber-500/30 select-none">✦ 📜 ✦</div>
        <div className="absolute bottom-3 left-3 text-[10px] font-serif text-amber-500/30 select-none">✦ 💀 ✦</div>
        <div className="absolute bottom-3 right-3 text-[10px] font-serif text-amber-500/30 select-none">✦ 💀 ✦</div>

        {/* Floating Halo around the Badge */}
        <div className="relative mb-6">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-dashed border-amber-500/20 rounded-full scale-150"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-dashed border-indigo-500/25 rounded-full scale-125"
          />
          <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl scale-125 -z-10 animate-pulse" />

          {/* Badge SVG Render */}
          <div className="p-4 rounded-full bg-slate-950/80 border border-amber-500/25 shadow-2xl relative z-10">
            <BadgeSVG id={badge.id} className="w-32 h-32" unlocked={true} />
          </div>
        </div>

        {/* Milestone Announcements */}
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-mono text-amber-400 font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 bg-amber-500/10 border border-amber-500/25 py-1 px-3.5 rounded-full mx-auto w-fit">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" /> STREAK MILESTONE SECURED <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          </span>

          <h2 className="text-xl font-serif font-bold text-slate-100 uppercase tracking-wider mt-4">
            {badge.name} Unlocked
          </h2>
          
          <p className="text-xs font-mono text-indigo-300 font-semibold uppercase tracking-widest">
            Trial of {badge.daysRequired} Consecutive Days
          </p>
        </div>

        {/* Scroll Divider */}
        <div className="w-full flex items-center justify-center gap-2 my-5 opacity-45">
          <div className="h-px bg-gradient-to-r from-transparent to-amber-500/60 flex-1" />
          <Scroll className="w-4 h-4 text-amber-400" />
          <div className="h-px bg-gradient-to-l from-transparent to-amber-500/60 flex-1" />
        </div>

        {/* Thematic Mythology Lore Scroll Content */}
        <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 text-slate-300 text-[11px] leading-relaxed font-sans text-left max-h-[140px] overflow-y-auto italic border-l-2 border-l-amber-500">
          <p className="mb-2 font-semibold text-slate-200">The Crematorium Scroll Chronicles:</p>
          "{badge.lore}"
        </div>

        {/* Reward Bonus Indicator */}
        <div className="mt-5 mb-2 flex items-center gap-2 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-4 rounded-xl">
          <Award className="w-4 h-4" />
          <span>Sovereign Blessing Granted: <strong>+50 KP Bonus</strong></span>
        </div>

        {/* Button: Claim Blessing */}
        <button
          onClick={onClose}
          id="btn-claim-sovereign-blessing"
          className="mt-6 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-serif font-bold py-3 px-6 rounded-2xl text-xs shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all cursor-pointer active:scale-[0.98]"
        >
          Claim Sovereign Blessing & Close
        </button>

      </motion.div>
    </div>
  );
};
