import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, BookOpen, Clock, User, Sparkles, Zap, Wind, 
  Volume2, VolumeX, Moon, Sun, Sunrise, RefreshCw,
  Ghost, Crown, Swords, Shield, Heart, Activity
} from 'lucide-react';

// @ts-ignore
import vikramBetaalCover from '../assets/images/vikram_betaal_cover_1783688336392.jpg';
// @ts-ignore
import kingVikramPortrait from '../assets/images/king_vikram_portrait_1783688721690.jpg';
// @ts-ignore
import betaalGhostPortrait from '../assets/images/betaal_ghost_portrait_1783688735092.jpg';

interface CinematicHeaderProps {
  systemDate: string;
  currentStreak: number;
  longestStreak: number;
  activeFlair: string | null;
  onShowStoryOverlay: () => void;
  userName: string;
}

type Realm = 'midnight' | 'eclipse' | 'dawn';

export const CinematicHeader: React.FC<CinematicHeaderProps> = ({
  systemDate,
  currentStreak,
  longestStreak,
  activeFlair,
  onShowStoryOverlay,
  userName
}) => {
  const [realm, setRealm] = useState<Realm>('midnight');
  const [mistEnabled, setMistEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isLightning, setIsLightning] = useState(false);
  const [betaalText, setBetaalText] = useState<string | null>(null);
  
  // New States and Refs for King Vikram
  const [vikramText, setVikramText] = useState<string | null>(null);
  const [walkSpeed, setWalkSpeed] = useState<'normal' | 'brisk' | 'charge'>('normal');

  const lightningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechBubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const vikramTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio synthesis for King Vikram's royal sword and footsteps
  const playVikramSound = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1. Shiiing of the Sword (resonance filter sweep)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.35);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.3);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(2800, now + 0.35);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.08, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);

      // 2. Majestic double step thud
      const drumOsc = ctx.createOscillator();
      const drumGain = ctx.createGain();
      const drumFilter = ctx.createBiquadFilter();

      drumOsc.type = 'triangle';
      drumOsc.frequency.setValueAtTime(115, now + 0.08);
      drumOsc.frequency.exponentialRampToValueAtTime(32, now + 0.2);

      drumFilter.type = 'lowpass';
      drumFilter.frequency.value = 130;

      drumGain.gain.setValueAtTime(0, now + 0.08);
      drumGain.gain.linearRampToValueAtTime(0.16, now + 0.1);
      drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      drumOsc.connect(drumFilter);
      drumFilter.connect(drumGain);
      drumGain.connect(ctx.destination);

      drumOsc.start(now + 0.08);
      drumOsc.stop(now + 0.3);

    } catch (err) {
      console.warn("Vikram sound blocked:", err);
    }
  };

  const triggerVikramAction = () => {
    const speedCycleMap: Record<'normal' | 'brisk' | 'charge', 'normal' | 'brisk' | 'charge'> = {
      normal: 'brisk',
      brisk: 'charge',
      charge: 'normal'
    };
    const nextSpeed = speedCycleMap[walkSpeed];
    setWalkSpeed(nextSpeed);
    playVikramSound();

    const quotesNormal = [
      "Silence is my vow, Betaal, but my stride never falters! (Normal Stride)",
      "The path of Dharma is a series of steps, not a leap. (Normal Stride)",
      "We walk in the dark to reach the light of wisdom. (Normal Stride)"
    ];
    const quotesBrisk = [
      "The speed of my focus shall outrun your illusions, Vetala! (Brisk Pace)",
      "Each habit built is a swift step closer to absolute truth! (Brisk Pace)",
      "My mind accelerates as your riddles grow deeper! (Brisk Pace)"
    ];
    const quotesCharge = [
      "No burden can withstand the absolute velocity of pure Satya! (Epic Dash)",
      "My resolve is blazing! I shall carry you to the sage at breakneck speed! (Epic Dash)",
      "Behold the power of unyielding consistency! Witness my charge! (Epic Dash)"
    ];

    let quoteList = quotesNormal;
    if (nextSpeed === 'brisk') quoteList = quotesBrisk;
    if (nextSpeed === 'charge') quoteList = quotesCharge;

    const randomQuote = quoteList[Math.floor(Math.random() * quoteList.length)];
    setVikramText(randomQuote);

    if (vikramTimeoutRef.current) clearTimeout(vikramTimeoutRef.current);
    vikramTimeoutRef.current = setTimeout(() => {
      setVikramText(null);
    }, 5500);
  };

  const getWalkConfig = () => {
    switch (walkSpeed) {
      case 'brisk':
        return { bounce: 0.6, leg: 0.3, dust: 0.6, title: "Brisk Pace" };
      case 'charge':
        return { bounce: 0.3, leg: 0.15, dust: 0.3, title: "Epic Dash" };
      case 'normal':
      default:
        return { bounce: 1.1, leg: 0.55, dust: 1.1, title: "Normal Stride" };
    }
  };

  const walkConfig = getWalkConfig();

  // Audio synthesis for lightning thunder and Betaal cackle
  const playLightningSound = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1. Lightning Crackle (White noise with rapid amplitude modulation)
      const bufferSize = ctx.sampleRate * 1.5; // 1.5 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1000;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      // Rapid spikes to simulate electricity cracking
      noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      noiseGain.gain.linearRampToValueAtTime(0.02, now + 0.1);
      noiseGain.gain.linearRampToValueAtTime(0.1, now + 0.15);
      noiseGain.gain.linearRampToValueAtTime(0.001, now + 0.6);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // 2. Heavy Thunder Rumble (Low-frequency sine waves with distortion and lowpass filter sweep)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const thunderGain = ctx.createGain();
      const thunderFilter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(65, now);
      osc1.frequency.exponentialRampToValueAtTime(30, now + 1.5);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(45, now);
      osc2.frequency.exponentialRampToValueAtTime(20, now + 2.0);

      thunderFilter.type = 'lowpass';
      thunderFilter.frequency.setValueAtTime(250, now);
      thunderFilter.frequency.exponentialRampToValueAtTime(40, now + 1.8);

      thunderGain.gain.setValueAtTime(0, now + 0.1); // Slightly delayed rumble
      thunderGain.gain.linearRampToValueAtTime(0.4, now + 0.3);
      thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      osc1.connect(thunderFilter);
      osc2.connect(thunderFilter);
      thunderFilter.connect(thunderGain);
      thunderGain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.3);
      osc2.stop(now + 2.3);

    } catch (err) {
      console.warn("Lightning audio synthesis blocked by browser auto-play policy:", err);
    }
  };

  const playBetaalLaugh = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Generate a series of high-pitched echoing cackling tones
      const notes = [440, 520, 480, 580, 510, 640, 550, 720]; // Ghoulish arpeggio
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gain = ctx.createGain();
        const delay = index * 0.15;

        // FM Synthesis for scary, robotic metallic voice
        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        mod.type = 'sine';
        mod.frequency.value = 45; // Vibrato rate
        modGain.gain.value = 150; // Pitch vibrato intensity

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);

        mod.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(ctx.destination);

        mod.start(now + delay);
        osc.start(now + delay);
        mod.stop(now + delay + 0.3);
        osc.stop(now + delay + 0.3);
      });
    } catch (err) {
      console.warn("Betaal cackle blocked:", err);
    }
  };

  const triggerLightning = () => {
    setIsLightning(true);
    playLightningSound();
    
    // Spooky Betaal phrases
    const betaalPhrases = [
      "Hahaha, Vikram! Keep walking, but if you speak, I shall escape!",
      "An intelligent king answers when asked, else his head splits in ten pieces!",
      "Your streak is like the transient corpse on my tree... fragile and heavy!",
      "Beware the transition of dawn, Vikram! The banyan tree calls my spirit!",
      "Why carry the weight of habits when the grave-mist consumes all?"
    ];
    const randomPhrase = betaalPhrases[Math.floor(Math.random() * betaalPhrases.length)];
    setBetaalText(randomPhrase);

    if (lightningTimeoutRef.current) clearTimeout(lightningTimeoutRef.current);
    if (speechBubbleTimeoutRef.current) clearTimeout(speechBubbleTimeoutRef.current);

    lightningTimeoutRef.current = setTimeout(() => {
      setIsLightning(false);
      // Immediately trigger laugh sound during lightning decay
      playBetaalLaugh();
    }, 250);

    speechBubbleTimeoutRef.current = setTimeout(() => {
      setBetaalText(null);
    }, 5500);
  };

  useEffect(() => {
    return () => {
      if (lightningTimeoutRef.current) clearTimeout(lightningTimeoutRef.current);
      if (speechBubbleTimeoutRef.current) clearTimeout(speechBubbleTimeoutRef.current);
      if (vikramTimeoutRef.current) clearTimeout(vikramTimeoutRef.current);
    };
  }, []);

  // Theme styling configurations based on active Realm
  const realmStyles = {
    midnight: {
      bg: 'from-indigo-950 via-slate-950 to-purple-950',
      glowColor: 'rgba(99,102,241,0.15)',
      cardBorder: 'border-slate-900',
      moonGlow: 'bg-indigo-300/10 shadow-[0_0_50px_rgba(147,197,253,0.3)]',
      moonColor: 'bg-slate-100',
      textColor: 'text-indigo-400',
      ambientColor: 'bg-indigo-500/5',
      particleColor: 'bg-indigo-400/40'
    },
    eclipse: {
      bg: 'from-red-950 via-slate-950 to-stone-950',
      glowColor: 'rgba(239,68,68,0.15)',
      cardBorder: 'border-red-950/40',
      moonGlow: 'bg-red-500/10 shadow-[0_0_60px_rgba(239,68,68,0.4)]',
      moonColor: 'bg-stone-950 border border-red-500/40',
      textColor: 'text-rose-400',
      ambientColor: 'bg-red-500/5',
      particleColor: 'bg-red-400/30'
    },
    dawn: {
      bg: 'from-violet-950 via-fuchsia-950 to-amber-950',
      glowColor: 'rgba(245,158,11,0.15)',
      cardBorder: 'border-amber-950/30',
      moonGlow: 'bg-amber-400/10 shadow-[0_0_50px_rgba(245,158,11,0.35)]',
      moonColor: 'bg-amber-100',
      textColor: 'text-amber-400',
      ambientColor: 'bg-amber-500/5',
      particleColor: 'bg-amber-400/30'
    }
  };

  const currentTheme = realmStyles[realm];

  // Render flair badges
  const renderFlairBadge = () => {
    if (!activeFlair) return null;
    const flairs: Record<string, { badgeText: string; className: string }> = {
      neophyte: { badgeText: "🌱 Neophyte", className: "text-slate-400 border-slate-800 bg-slate-900/60" },
      enlightened: { badgeText: "✨ Enlightened", className: "text-amber-400 border-amber-500/30 bg-amber-950/10 shadow-[0_0_8px_rgba(245,158,11,0.2)]" },
      sage: { badgeText: "👑 Sage", className: "text-indigo-400 border-indigo-500/30 bg-indigo-950/10 shadow-[0_0_10px_rgba(99,102,241,0.2)] animate-pulse" },
      companion: { badgeText: "💀 Companion", className: "text-rose-400 border-rose-500/30 bg-rose-950/10 shadow-[0_0_12px_rgba(244,63,94,0.2)] font-serif font-bold" },
      weaver: { badgeText: "🌀 Weaver", className: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 border-cyan-500/20 bg-slate-950 font-bold" }
    };
    const f = flairs[activeFlair] || flairs.neophyte;
    return (
      <div className={`flex items-center border px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold ${f.className}`}>
        {f.badgeText}
      </div>
    );
  };

  return (
    <header 
      id="cinematic-header-root" 
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-900/40 shadow-2xl bg-gradient-to-b ${currentTheme.bg} transition-colors duration-1000 mb-8`}
    >
      {/* Lightning Strike Overlay */}
      <AnimatePresence>
        {isLightning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [1, 0.8, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-slate-100 mix-blend-overlay z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Floating Sparkles & Ash Particles in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${currentTheme.particleColor}`}
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80 + 10}%`,
            }}
            animate={{
              y: [0, -80, 0],
              x: [0, (Math.random() - 0.5) * 30, 0],
              opacity: [0.1, 0.7, 0.1],
              scale: [0.8, 1.4, 0.8]
            }}
            transition={{
              duration: 6 + Math.random() * 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      {/* Parallax Theater & Sky Stage */}
      <div className="relative w-full h-[360px] sm:h-[420px] md:h-[450px] bg-slate-950/20 border-b border-slate-900/50 flex flex-col justify-between p-6 z-10 overflow-hidden select-none">
        
        {/* Real Character Cinematic Backdrop */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none">
          <img 
            src={vikramBetaalCover} 
            alt="Cinematic Character Portrait of King Vikram and Betaal" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity hover:opacity-45 transition-opacity duration-1000 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,1,8,0.95)_100%)]" />
        </div>

        {/* Floating Sparks / Crematorium Embers */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          {[...Array(18)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-orange-400"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 15}%`,
                filter: 'blur(1px) drop-shadow(0 0 5px #f59e0b)',
              }}
              animate={{
                y: [0, -450],
                x: [0, (Math.random() - 0.5) * 120],
                opacity: [0, 0.9, 0.9, 0],
                scale: [0.6, 1.4, 0.6],
              }}
              transition={{
                duration: 4.5 + Math.random() * 5.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: Math.random() * 5.5,
              }}
            />
          ))}
        </div>
        
        {/* Sky Elements */}
        <div className="absolute top-10 left-10 md:left-24 flex items-center gap-4 z-10">
          {/* Detailed Interactive Moon or Eclipse Sun */}
          <div className="relative">
            <div className={`w-16 h-16 rounded-full transition-all duration-1000 ${currentTheme.moonGlow} flex items-center justify-center`}>
              <div className={`w-11 h-11 rounded-full transition-all duration-1000 ${currentTheme.moonColor} relative overflow-hidden`}>
                {realm === 'midnight' && (
                  <div className="absolute -top-1 -right-1 w-10 h-10 bg-indigo-950/60 rounded-full" />
                )}
                {realm === 'eclipse' && (
                  <div className="absolute inset-0.5 bg-black rounded-full shadow-[inset_0_0_10px_rgba(239,68,68,0.7)]" />
                )}
              </div>
            </div>
            {/* Twinkling star near moon */}
            <motion.div 
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -top-2 -right-2 text-amber-300 text-xs"
            >
              ✦
            </motion.div>
          </div>

          {/* Epic Scrolling Mythology Quote / Narrative Header */}
          <div className="max-w-[180px] sm:max-w-md bg-slate-950/50 backdrop-blur-sm border border-slate-900/60 rounded-xl px-3 py-1.5 font-sans">
            <span className={`text-[8px] font-mono uppercase tracking-widest font-bold ${currentTheme.textColor} block mb-0.5`}>
              {realm === 'midnight' ? "Midnight Crematorium" : realm === 'eclipse' ? "The Shadow Eclipse" : "Celestial Twilight"}
            </span>
            <p className="text-[10px] text-slate-300 italic leading-snug">
              {realm === 'midnight' && "The dead trees rustle. Vikram shoulders his heavy burden under the lunar spell."}
              {realm === 'eclipse' && "Rahu consumes the sun. Cosmic winds blow wild as Betaal whispers dark riddles."}
              {realm === 'dawn' && "The sacred Brahma Muhurta. The veil of illusions breaks under celestial rays."}
            </p>
          </div>
        </div>

        {/* Dynamic Flying Betaal Specter */}
        <div className="absolute top-[16%] right-[8%] sm:right-[15%] z-20">
          <motion.div
            animate={{ 
              y: [-18, 18, -18],
              x: [-10, 10, -10],
              rotate: [-4, 4, -4]
            }}
            transition={{ 
              duration: 4.8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative cursor-pointer group flex flex-col items-center"
            onClick={triggerLightning}
            title="Click Betaal to hear his riddle laughter!"
          >
            {/* Ghostly Aura Glow */}
            <div className={`absolute -inset-10 rounded-full blur-3xl opacity-60 transition-colors duration-1000 ${
              realm === 'eclipse' ? 'bg-red-600/40' : realm === 'dawn' ? 'bg-amber-500/30' : 'bg-fuchsia-600/50'
            } group-hover:scale-125 transition-transform`} />

            {/* Speach Bubble */}
            <AnimatePresence>
              {betaalText && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: -95 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  className="absolute left-1/2 -translate-x-1/2 bg-slate-950/95 border border-purple-500/40 rounded-2xl p-3 shadow-[0_0_25px_rgba(168,85,247,0.4)] text-[10px] font-sans font-medium text-slate-200 w-[180px] sm:w-[220px] text-center z-30 pointer-events-none"
                >
                  <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950 border-r border-b border-purple-500/40 rotate-45" />
                  <p className="leading-relaxed">"{betaalText}"</p>
                  <span className="text-[7.5px] font-mono text-purple-400 block mt-1 uppercase font-bold tracking-widest">☠️ Cackle echo ☠️</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* High-Fidelity Betaal Portrait & Spectral Box (Seamless feathered, zero card borders) */}
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 group-hover:scale-105 transition-all duration-300 flex items-center justify-center">
              {/* Magic background aura */}
              <div className="absolute inset-4 bg-gradient-to-tr from-purple-600/20 to-indigo-600/30 rounded-full blur-2xl opacity-75" />
              
              {/* Real character cutout via radial mask */}
              <div 
                className="w-full h-full"
                style={{
                  WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)',
                  maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)',
                  mixBlendMode: 'screen'
                }}
              >
                <img 
                  src={betaalGhostPortrait} 
                  alt="Betaal the Spectral Ghost with white hair" 
                  className="w-full h-full object-cover select-none pointer-events-none filter brightness-110 contrast-125 saturate-110"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* White hair label / Boss identity indicator */}
              <div className="absolute -top-1 right-2 bg-purple-950/95 border border-purple-500/40 px-2 py-0.5 rounded-full text-[8.5px] font-mono text-purple-300 uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-1">
                <Ghost className="w-2.5 h-2.5 text-purple-400" />
                LVL 99 BOSS
              </div>
            </div>

            {/* RPG Style Stats Widget for Betaal */}
            <div className="mt-2 text-center bg-slate-950/90 backdrop-blur-md border border-purple-500/30 p-2 rounded-xl min-w-[140px] shadow-2xl pointer-events-none border-t-2 border-t-purple-400">
              <div className="flex items-center justify-center gap-1">
                <Ghost className="w-3 h-3 text-purple-400 animate-pulse" />
                <span className="text-[9.5px] font-serif font-bold text-purple-300 tracking-wider">The Betaal</span>
              </div>
              <div className="mt-1 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full w-[85%] animate-pulse" />
              </div>
              <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-400 mt-1">
                <span>Spectral Energy</span>
                <span className="text-purple-400 font-bold">850/1000 AP</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mystic Crematorium Dhuni Fire Campfire (Center stage) */}
        <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            {/* Pulsing Fire Glow */}
            <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-orange-600/25 blur-2xl animate-pulse" />
            <div className="absolute w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/35 blur-xl animate-pulse" />
            
            {/* Animated SVG Flames */}
            <svg className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]" viewBox="0 0 100 100">
              <motion.path
                d="M 50,90 Q 30,70 40,40 Q 50,10 50,10 Q 50,10 60,40 Q 70,70 50,90"
                fill="url(#fire-grad-primary)"
                animate={{ scaleY: [1, 1.25, 0.85, 1.15, 1], scaleX: [1, 0.85, 1.15, 0.9, 1], y: [0, -4, 2, -1, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.path
                d="M 50,90 Q 35,75 45,50 Q 50,25 50,25 Q 50,25 55,50 Q 65,75 50,90"
                fill="url(#fire-grad-secondary)"
                animate={{ scaleY: [1, 0.85, 1.15, 0.9, 1], scaleX: [1, 1.15, 0.85, 1.05, 1], y: [0, 3, -3, 1, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
              />
              <defs>
                <linearGradient id="fire-grad-primary" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#b91c1c" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="fire-grad-secondary" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Realistic Logs */}
            <div className="absolute bottom-1.5 w-10 h-2 bg-amber-950 border border-amber-900/50 rounded-full transform rotate-12 shadow-lg" />
            <div className="absolute bottom-1.5 w-10 h-2 bg-amber-950 border border-amber-900/50 rounded-full transform -rotate-12 shadow-lg" />
          </div>
          
          <span className="text-[7.5px] font-mono text-orange-400 tracking-widest uppercase font-bold bg-slate-950/80 border border-orange-500/30 px-2 py-0.5 rounded-full shadow-lg -mt-1 backdrop-blur-xs flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
            🔥 Dhuni Fire
          </span>
        </div>

        {/* Dynamic Walking King Vikram */}
        <div 
          onClick={triggerVikramAction}
          className="absolute bottom-[2%] left-[10%] sm:left-[18%] z-20 cursor-pointer group/vikram"
          title="Click King Vikram to cycle walking pace and trigger royal quotes!"
        >
          {/* Vikram's Speech Bubble */}
          <AnimatePresence>
            {vikramText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: -125 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                className="absolute left-1/2 -translate-x-1/2 bg-slate-950/95 border border-amber-500/40 rounded-2xl p-3 shadow-[0_0_25px_rgba(245,158,11,0.4)] text-[10px] font-sans font-medium text-slate-200 w-[180px] sm:w-[220px] text-center z-30 pointer-events-none"
              >
                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950 border-r border-b border-amber-500/40 rotate-45" />
                <p className="leading-relaxed">"{vikramText}"</p>
                <span className="text-[7.5px] font-mono text-amber-400 block mt-1 uppercase font-bold tracking-widest">👑 Royal Will 👑</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            key={walkSpeed}
            animate={{ 
              y: [0, -6, 0],
              rotate: [-2, 2, -2]
            }}
            transition={{ 
              duration: walkConfig.bounce, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative flex flex-col items-center"
          >
            {/* Speed Badge Overlay */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 text-[8px] font-mono font-bold opacity-0 group-hover/vikram:opacity-100 transition-opacity whitespace-nowrap">
              {walkConfig.title} (Click to Cycle)
            </div>

            {/* Dust sparks at feet */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-3 bg-amber-500/20 rounded-full blur-md"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: walkConfig.dust, repeat: Infinity }}
            />

            {/* Heroic Portrait frame of King Vikram (Seamless feathered, zero card borders) */}
            <div className="relative w-36 h-48 sm:w-44 sm:h-56 md:w-48 md:h-60 group-hover/vikram:scale-105 transition-all duration-300 flex items-center justify-center">
              {/* Ground level ambient golden dust glow */}
              <div className="absolute bottom-0 w-28 h-28 bg-amber-500/20 rounded-full blur-2xl" />

              {/* Real character cutout via radial ellipse mask */}
              <div 
                className="w-full h-full"
                style={{
                  WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 80%)',
                  maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 80%)',
                  mixBlendMode: 'screen'
                }}
              >
                <img 
                  src={kingVikramPortrait} 
                  alt="King Vikramaditya, Brave Ancient Indian Warrior King" 
                  className="w-full h-full object-cover select-none pointer-events-none filter brightness-110 contrast-115 saturate-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Golden Crown overlay indicator */}
              <div className="absolute -top-1 left-2 bg-amber-950/95 border border-amber-500/40 px-2 py-0.5 rounded-full text-[8.5px] font-mono text-amber-300 uppercase tracking-widest font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <Crown className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                SOVEREIGN KING
              </div>
            </div>

            {/* RPG Style Stats Widget for King Vikram */}
            <div className="mt-2 text-center bg-slate-950/90 backdrop-blur-md border border-amber-500/30 p-2 rounded-xl min-w-[140px] shadow-2xl pointer-events-none border-t-2 border-t-amber-400">
              <div className="flex items-center justify-center gap-1">
                <Swords className="w-3 h-3 text-amber-400 animate-bounce" />
                <span className="text-[9.5px] font-serif font-bold text-amber-300 tracking-wider">King Vikram</span>
              </div>
              <div className="mt-1 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600 to-amber-400 h-full w-[100%] transition-all duration-500" />
              </div>
              <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-400 mt-1">
                <span>Royal Resolve</span>
                <span className="text-amber-400 font-bold">100/100 WP</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Rolling Crematorium Fog/Mist Layers */}
        {mistEnabled && (
          <>
            {/* Mist Layer 1 */}
            <motion.div 
              className="absolute bottom-[-10px] inset-x-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none z-30"
              animate={{ x: [0, -150, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            {/* Mist Layer 2 */}
            <motion.div 
              className="absolute bottom-[-5px] inset-x-0 h-12 bg-gradient-to-t from-indigo-950/20 to-transparent pointer-events-none z-30 opacity-70"
              animate={{ x: [-100, 100, -100] }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}

        {/* Bottom Bar: Action buttons and settings overlay inside theater */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30">
          
          {/* Quick Sound Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl bg-slate-950/70 border border-slate-900 text-slate-300 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors cursor-pointer"
            title={audioEnabled ? "Mute Spooky Audio Synthesis" : "Unmute Spooky Audio Synthesis"}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Mist Toggle */}
          <button
            onClick={() => setMistEnabled(!mistEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              mistEnabled 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-slate-950/70 border-slate-900 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Animated Crematorium Mist"
          >
            <Wind className="w-3.5 h-3.5" />
          </button>

          {/* Trigger Lightning */}
          <button
            onClick={triggerLightning}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 hover:border-amber-500 text-amber-400 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 cursor-pointer"
            title="Strike Lightning & Trigger Betaal's Cackle"
          >
            <Zap className="w-3.5 h-3.5 fill-current animate-bounce text-amber-400" /> STRIKE LIGHTNING
          </button>
        </div>

        {/* Realm Switching Controls (Floating Top Right) */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950/60 backdrop-blur-md border border-slate-900/60 p-1 rounded-xl z-30">
          <button
            onClick={() => setRealm('midnight')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              realm === 'midnight' 
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
            title="Switch to Midnight Crematorium"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setRealm('eclipse')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              realm === 'eclipse' 
                ? 'bg-red-500/20 text-rose-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
            title="Switch to Shadow Eclipse"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setRealm('dawn')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              realm === 'dawn' 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
            title="Switch to Celestial Twilight"
          >
            <Sunrise className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title Banner & Statistics Dashboard Bar */}
      <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 bg-slate-950/80 backdrop-blur-md">
        
        {/* Core Branding Info */}
        <div className="flex items-center gap-4.5">
          {/* Flame Logo with pulsing neon aura */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-950 to-slate-900 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)] animate-pulse">
            <Flame className="w-7 h-7 text-indigo-400 fill-current" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Dynamic cool font headings */}
              <h1 className="text-xl sm:text-2xl font-cinzel-deco font-black tracking-widest text-slate-100 uppercase bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                The Vikram-Betaal Chronicles
              </h1>
              <span className="text-[9px] bg-slate-900 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-space uppercase font-bold tracking-wider shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                Celestial Habit Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-space">
              Consistencies Trial • Devised by the Maharaja to capture the elusive riddle-vampire
            </p>
          </div>
        </div>

        {/* User Context & Action buttons */}
        <div className="flex items-center gap-3.5 flex-wrap justify-end">
          {/* Replay Story Prologue */}
          <button
            onClick={onShowStoryOverlay}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-indigo-500/20 px-4 py-2 rounded-2xl text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            title="Replay Vikram-Betaal Scroll Prologue"
          >
            <BookOpen className="w-4 h-4" /> Replay Prologue
          </button>

          {/* Simulated Epoch Time */}
          <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950 border border-slate-900/60 px-4 py-2 rounded-2xl font-mono">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Simulated Epoch: <strong className="text-slate-100">{systemDate}</strong></span>
          </div>

          {/* Profile User Tag */}
          <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-900/60 px-4 py-2 rounded-2xl">
            <User className="w-4 h-4 text-slate-500" />
            <span className="text-[11px] text-slate-300 font-medium font-mono">{userName}</span>
          </div>

          {/* Active Flair Badge Render */}
          {renderFlairBadge()}
        </div>
      </div>
    </header>
  );
};
