import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Skull, Crown, Scale, Flame, Scroll, HelpCircle, 
  Volume2, VolumeX, ShieldCheck, RefreshCw, Trophy, MapPin, CheckCircle2,
  BookOpen, Star, Info, Zap, Shield, Sparkle
} from 'lucide-react';

interface VikramBetaalQuestAstrolabeProps {
  state: {
    karmaPoints: number;
    currentStreak: number;
    longestStreak: number;
    unlockedBadges: string[];
    logs: any[];
    activeFlair: string | null;
  };
  onChangeState: React.Dispatch<React.SetStateAction<any>>;
  onNotify: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

interface Chapter {
  id: number;
  title: string;
  synopsis: string;
  riddle: string;
  options: string[];
  correctAnswer: number;
  resolvedBonus: string;
}

const CHRONICLES: Chapter[] = [
  {
    id: 1,
    title: "The Three Delicate Queens",
    synopsis: "The first queen is hurt by a lotus petal falling on her lap, the second is burned by moonbeams, and the third is bruised by the distant sound of a pestle. Who is the most delicate?",
    riddle: "Which queen exhibits the truest, most absolute form of delicateness?",
    options: [
      "The queen hurt by a falling lotus flower.",
      "The queen burned by the cold moonbeams.",
      "The queen bruised by the distant sound of a pestle.",
      "None, all are exaggerating to seek royal attention."
    ],
    correctAnswer: 2,
    resolvedBonus: "Delicacy of Soul"
  },
  {
    id: 5,
    title: "The Thief & the Royal Guard",
    synopsis: "A loyal minister rescues a beautiful maiden, but a thief and a guard both claim her hand. Vikram must rule who has the highest ethical right to marry her.",
    riddle: "Who has the absolute highest ethical claim according to ancient Dharma?",
    options: [
      "The thief who saw her beauty first.",
      "The guard who protected her with his shield.",
      "The minister who paid her ransom with state funds.",
      "The woman herself, who must exercise sovereign free will."
    ],
    correctAnswer: 3,
    resolvedBonus: "Sovereign Choice"
  },
  {
    id: 12,
    title: "The Three Ultimate Suitors",
    synopsis: "A young lady dies. One suitor jumps into her funeral pyre, the second learns the art of resurrection to bring her back, and the third guards her ashes. Who becomes her husband?",
    riddle: "Who is ethically entitled to be her husband after her resurrection?",
    options: [
      "The one who brought her back to life (acting as her father/creator).",
      "The one who jumped into the pyre (acting as a re-born brother).",
      "The one who guarded her ashes (acting as a true devoted lover).",
      "The king himself as arbitrator of Ujjain."
    ],
    correctAnswer: 2,
    resolvedBonus: "True devotion of ashes"
  },
  {
    id: 20,
    title: "The Father & Son's Strange Marriage",
    synopsis: "A father and son find footprints of a queen and princess. They vow: father marries the lady with larger feet, son marries the smaller. But the mother has smaller feet! The children born of these cross-marriages share a puzzling bloodline.",
    riddle: "What is the relation between the children of the father and the princess, and the son and the queen?",
    options: [
      "They are cousins through legal affinity.",
      "They are uncles and nephews to each other.",
      "They are brothers with zero blood overlap.",
      "They share a paradoxical relationship where each is the other's uncle/nephew."
    ],
    correctAnswer: 3,
    resolvedBonus: "Paradox of Bloodlines"
  }
];

const VIRTUES = [
  { 
    name: "Dharma (Duty)", 
    effect: "+35% Quiz Wisdom Bonus", 
    color: "text-indigo-400 border-indigo-500/30", 
    hex: "#6366f1",
    desc: "The supreme cosmic law of righteous duty. Aligning with Dharma guides your intellect, granting you a divine +35% bonus wisdom during learning challenges.",
    iconMarkup: (
      <svg className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  },
  { 
    name: "Satya (Truth)", 
    effect: "+15 Daily KP Passive Blessing", 
    color: "text-cyan-400 border-cyan-500/30", 
    hex: "#22d3ee",
    desc: "Uncompromising truthfulness that cuts through worldly illusions. Your honesty evokes a daily blessing of +15 Karma Points, directly deposited into your reserve.",
    iconMarkup: (
      <svg className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 11 2 2 4-4" />
      </svg>
    )
  },
  { 
    name: "Tapas (Focus)", 
    effect: "Streak Protection Shield Active", 
    color: "text-amber-400 border-amber-500/30", 
    hex: "#f59e0b",
    desc: "The heat of intense focus and rigorous learning. Tapas shields your learning streak, preventing any loss even if state duties delay your studies for a day.",
    iconMarkup: (
      <svg className="w-8 h-8 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    )
  },
  { 
    name: "Virya (Courage)", 
    effect: "Double Karma Point Multiplier", 
    color: "text-rose-400 border-rose-500/30", 
    hex: "#f43f5e",
    desc: "Indomitable strength to conquer difficult subjects. Virya doubles all Karma Points gained from solving Vetala's ancient riddles and scroll completions.",
    iconMarkup: (
      <svg className="w-8 h-8 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
        <path d="M13 19h2a1 1 0 0 0 1-1v-2" />
        <path d="M16 16 20 20" />
      </svg>
    )
  },
  { 
    name: "Jnana (Wisdom)", 
    effect: "Instant Riddles Unlock", 
    color: "text-emerald-400 border-emerald-500/30", 
    hex: "#10b981",
    desc: "Pure spiritual knowledge and clarity of mind. Jnana dissolves the seal of the 24 Chronicles, immediately unlocking access to all deep historical chambers.",
    iconMarkup: (
      <svg className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    )
  },
  { 
    name: "Tyaga (Sacrifice)", 
    effect: "+50 Karma Reserve Bonus", 
    color: "text-fuchsia-400 border-fuchsia-500/30", 
    hex: "#d946ef",
    desc: "Renunciation of immediate reward for long-term growth. This noble sacrifice releases bound cosmic energy, awarding you a flat +50 Karma Reserve Bonus.",
    iconMarkup: (
      <svg className="w-8 h-8 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    )
  },
  { 
    name: "Shanti (Peace)", 
    effect: "Vow Meditation Aura Active", 
    color: "text-teal-400 border-teal-500/30", 
    hex: "#14b8a6",
    desc: "A calm, unshakeable sanctuary inside the soul. Shanti triggers a deep focus aura that empowers your daily study vows and shields against external stress.",
    iconMarkup: (
      <svg className="w-8 h-8 text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z" />
        <path d="M2 12h20" />
      </svg>
    )
  }
];

export const VikramBetaalQuestAstrolabe: React.FC<VikramBetaalQuestAstrolabeProps> = ({
  state,
  onChangeState,
  onNotify
}) => {
  const [burden, setBurden] = useState<number>(30); // in kg
  const [activeChapterId, setActiveChapterId] = useState<number>(1);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [riddleResult, setRiddleResult] = useState<'correct' | 'wrong' | null>(null);
  const [solvedChapters, setSolvedChapters] = useState<number[]>([]);
  
  // Astrolabe wheel states
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [pointerWobble, setPointerWobble] = useState(false);
  const [spinResult, setSpinResult] = useState<typeof VIRTUES[0] | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const [vowInput, setVowInput] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [isBetaalCackling, setIsBetaalCackling] = useState(false);
  const [betaalBubbleText, setBetaalBubbleText] = useState<string | null>(null);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    };
  }, []);

  const playBetaalCackle = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Eerie cackling laughter sequence
      for (let i = 0; i < 5; i++) {
        const delay = i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        const startFreq = 160 + Math.sin(i * 1.5) * 50;
        osc.frequency.setValueAtTime(startFreq, now + delay);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 1.8, now + delay + 0.08);
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, now + delay);
        
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.04, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 0.12);
      }
    } catch (err) {}
  };

  const handleBetaalClick = () => {
    setIsBetaalCackling(true);
    playBetaalCackle();
    
    const responses = [
      "The heavier your doubts, King, the sweeter my weight!",
      "Are you walking towards truth, or just running from your shadow?",
      "Every task you skip adds a heavy boulder to your back, Vikram!",
      "Hahaha! Your persistence is strong, but is your intellect sharp enough?",
      "Silence! Each step you take is a vow carved in stone!",
      "If you fail to answer my next riddle, your head will shatter into a thousand pieces!",
      "Hahaha! A light soul carries no burden. Can you achieve absolute focus?"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    setBetaalBubbleText(randomResponse);
    
    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    bubbleTimeoutRef.current = setTimeout(() => {
      setIsBetaalCackling(false);
      setBetaalBubbleText(null);
    }, 4500);
  };

  // Web Audio synthesizer for mechanical clicking and mystical chime
  const playPegSound = (frequency = 600) => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.05);
    } catch (err) {}
  };

  const playSound = (type: 'spin' | 'solve' | 'vow' | 'wrong' | 'chime') => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'vow') {
        const freqs = [261.63, 329.63, 392.00, 523.25]; // C major
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.08, now + i * 0.1 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.6);
        });
      } else if (type === 'chime') {
        // Mystical resonant chime chord on reward
        const freqs = [329.63, 440.00, 554.37, 659.25, 880.00]; // A major 9th cascade
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          filter.type = 'lowpass';
          filter.frequency.value = 1800;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.8);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 1.2);
        });
      } else if (type === 'solve') {
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        osc1.frequency.setValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc1.stop(now + 0.4);
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.4);
      }
    } catch (err) {}
  };

  // Submit Answer to the Story Riddle
  const handleAnswerSubmit = (chap: Chapter) => {
    if (selectedAnswer === null) return;

    if (selectedAnswer === chap.correctAnswer) {
      setRiddleResult('correct');
      if (!solvedChapters.includes(chap.id)) {
        setSolvedChapters(prev => [...prev, chap.id]);
        
        onChangeState((prev: any) => ({
          ...prev,
          karmaPoints: prev.karmaPoints + 20,
          logs: [
            {
              activityId: `riddle-solve-${chap.id}-${Date.now()}`,
              activityName: `Deciphered Vetala Riddle: ${chap.title}`,
              activityType: 'quiz',
              points: 20,
              date: prev.systemDate || "Ujjain Epoch",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...prev.logs
          ]
        }));
        
        playSound('solve');
        onNotify(`✨ Divine Wisdom Unlocked: Correct answer! Earned +20 KP.`, 'success');
      }
    } else {
      setRiddleResult('wrong');
      playSound('wrong');
      onNotify(`💀 Betaal cackles: "Incorrect, Vikram! Speak falsely or ignorantly, and your head breaks!"`, 'error');
    }
  };

  // Click simulation with decelerating ticks
  const simulatePegClicks = () => {
    let tickCount = 0;
    const maxTicks = 28;
    
    const scheduleTick = () => {
      if (tickCount >= maxTicks) return;
      playPegSound(400 + tickCount * 18);
      setPointerWobble(true);
      setTimeout(() => setPointerWobble(false), 55);
      
      tickCount++;
      const progress = tickCount / maxTicks;
      // Delays slow down exponentially from 45ms to 500ms
      const nextDelay = 45 + Math.pow(progress, 3.2) * 550;
      setTimeout(scheduleTick, nextDelay);
    };

    scheduleTick();
  };

  // Dynamic Astrolabe Wheel Spin Calculation
  const handleSpinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSpinResult(null);

    // Pick random target index
    const chosenIndex = Math.floor(Math.random() * VIRTUES.length);
    const chosenVirtue = VIRTUES[chosenIndex];

    // Precalculate target angle so needle aligns exactly under 12 o'clock pointer
    // Each wedge is (360/7) degrees. Angle 0 is at top, index 0 center is -25.7 deg.
    const wedgeAngle = 360 / 7;
    const targetWedgeOffset = chosenIndex * wedgeAngle + wedgeAngle / 2;
    
    // Add 5 full rotations (1800 degrees) for dramatic acceleration, then offset counter-clockwise
    const spinDegrees = 1800 + (360 - targetWedgeOffset);
    const targetRotationValue = wheelRotation + spinDegrees;

    setWheelRotation(targetRotationValue);
    simulatePegClicks();

    // Trigger completion modal when spin settles (2.5 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      setSpinResult(chosenVirtue);
      setShowRewardModal(true);

      // Award dynamic Karma Point reward to main application
      onChangeState((prev: any) => ({
        ...prev,
        karmaPoints: prev.karmaPoints + 25,
        logs: [
          {
            activityId: `astrolabe-${Date.now()}`,
            activityName: `Attuned Cosmic Astrolabe: ${chosenVirtue.name}`,
            activityType: 'spaced-rep',
            points: 25,
            date: prev.systemDate || "Ujjain Epoch",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev.logs
        ]
      }));

      playSound('chime');
      onNotify(`🔮 Astrolabe Aligned! Attuned to ${chosenVirtue.name}. (+25 KP Granted)`, 'success');
    }, 2500);
  };

  // Lighten the Burden with study vows
  const handleVowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vowInput.trim()) return;

    setBurden(prev => Math.max(0, prev - 25));
    
    onChangeState((prev: any) => ({
      ...prev,
      karmaPoints: prev.karmaPoints + 15,
      logs: [
        {
          activityId: `vow-${Date.now()}`,
          activityName: `Vow Taken: "${vowInput}"`,
          activityType: 'spaced-rep',
          points: 15,
          date: prev.systemDate || "Ujjain Epoch",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev.logs
      ]
    }));

    playSound('vow');
    onNotify(`📜 Royal Vow Registered: "${vowInput}". Your burden lightens. +15 Karma Points!`, 'success');
    setVowInput("");
  };

  // Burden indicator messages
  const getVikramDialogue = () => {
    if (burden <= 25) {
      return {
        mode: "Light Spirit",
        text: "The corpse feels light as dry hay. Betaal's voice is but a sweet whisper in the night wind.",
        betaal: "Ah, Vikram, your mind is free of unresolved debts! Let us proceed quickly...",
        color: "text-emerald-400"
      };
    } else if (burden <= 55) {
      return {
        mode: "Doubtful Stride",
        text: "The weight of unfinished habits makes Vikram's spine bend. The graveyard mist turns dense.",
        betaal: "King, the burden of procrastination is dragging your feet! Answer me or remain here forever!",
        color: "text-amber-400"
      };
    } else if (burden <= 80) {
      return {
        mode: "Sins of Neglect",
        text: "Sweat drips from Vikram's forehead. Betaal's skeletal wings cast terrifying shadows in the moonlight.",
        betaal: "Hahaha! The heavier your backlog of studies, the heavier I grow. Do not falter now, Maharaja!",
        color: "text-rose-400"
      };
    } else {
      return {
        mode: "Cosmic Inertia",
        text: "Vikram can barely lift his boots. A vortex of blue ash and sparks swirls around the pair.",
        betaal: "Your head is heavy with state worries and unfulfilled vows! You are carrying the weight of the universe!",
        color: "text-red-500 font-bold animate-pulse"
      };
    }
  };

  const status = getVikramDialogue();
  const currentChapter = CHRONICLES.find(c => c.id === activeChapterId) || CHRONICLES[0];

  // Mathematical SVG generation for the 7 Wheel Wedges
  const svgCenter = 150;
  const svgRadius = 140;
  const numVirtues = VIRTUES.length;
  const anglePerWedge = 360 / numVirtues;

  const precomputedSlices = VIRTUES.map((virtue, idx) => {
    // 12 o'clock starts at -90 degrees in standard SVG math coordinates
    const startAngle = idx * anglePerWedge - 90;
    const endAngle = (idx + 1) * anglePerWedge - 90;
    const rad = Math.PI / 180;

    const x1 = svgCenter + svgRadius * Math.cos(startAngle * rad);
    const y1 = svgCenter + svgRadius * Math.sin(startAngle * rad);
    const x2 = svgCenter + svgRadius * Math.cos(endAngle * rad);
    const y2 = svgCenter + svgRadius * Math.sin(endAngle * rad);

    const pathData = `
      M ${svgCenter} ${svgCenter}
      L ${x1} ${y1}
      A ${svgRadius} ${svgRadius} 0 0 1 ${x2} ${y2}
      Z
    `;

    // Position of custom label/icon inside slice
    const midAngle = startAngle + anglePerWedge / 2;
    const labelRadius = svgRadius * 0.62;
    const tx = svgCenter + labelRadius * Math.cos(midAngle * rad);
    const ty = svgCenter + labelRadius * Math.sin(midAngle * rad);

    return {
      ...virtue,
      pathData,
      midAngle,
      tx,
      ty
    };
  });

  return (
    <div 
      id="vikram-astrolabe-panel" 
      className="bg-slate-950 border border-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mb-8"
    >
      {/* Decorative background vectors */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/5 rounded-full border border-indigo-500/10 pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-60 h-60 bg-purple-500/5 rounded-full border border-purple-500/10 pointer-events-none" />

      {/* Header Deck */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-5 mb-6">
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Astro-Karmic Astrolabe
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-100 uppercase tracking-wider mt-1">
            Vikram's Quest & Destiny Harmonizer
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Lighten the karmic corpse burden, solve ancient graveyard riddles, and tune your spiritual frequency with the Wheel of Wills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
            title="Toggle Audio Synthesizer"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>

          <div className="text-[10px] font-mono bg-slate-900 border border-slate-800/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5">
            <span>Reserves: <strong className="text-indigo-400">{state.karmaPoints} KP</strong></span>
          </div>
        </div>
      </div>

      {/* Main Astrolabe Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (7 COLS): Corpse Weight Slider & Chapters */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Weight & Vow simulator */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Skull className="w-4 h-4 text-purple-400" /> Corpse Vow Burden Simulator
              </h3>
              <span className={`text-[10px] font-mono uppercase font-bold px-2.5 py-0.5 rounded-full border bg-slate-950 ${status.color}`}>
                {status.mode}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 font-mono leading-relaxed">
              Adjust the slider to simulate the "Karmic Weight" of backlog tasks or unfinished studies. Take a royal vow to instantly lighten Vikram's load and receive a blessing!
            </p>

            {/* Slider control */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <span className="text-slate-500">Karmic Weight of Unfinished Vows:</span>
                <span className="text-slate-200 font-bold">{burden} kg / 100 kg</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={burden} 
                onChange={(e) => {
                  setBurden(Number(e.target.value));
                  if (audioEnabled && Number(e.target.value) % 15 === 0) {
                    playPegSound(300 + Number(e.target.value) * 4);
                  }
                }}
                className="w-full accent-indigo-500 bg-slate-900 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1">
                <span>0kg (Pure Spirit)</span>
                <span>50kg (Average Weight)</span>
                <span>100kg (Celestial Gravitas)</span>
              </div>
            </div>

            {/* Visual character panel */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/60 border border-slate-900 rounded-xl p-4 mb-4 relative overflow-visible">
              
              {/* Floating speech bubble when clicked */}
              <AnimatePresence>
                {betaalBubbleText && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="absolute -top-16 left-4 right-4 md:-top-20 md:left-6 md:right-6 bg-purple-950/95 border border-purple-800 text-purple-200 px-4 py-2.5 rounded-2xl text-xs font-mono shadow-[0_0_25px_rgba(168,85,247,0.35)] z-50 flex items-start gap-2 backdrop-blur-md"
                  >
                    <span className="text-base leading-none">💀</span>
                    <div>
                      <strong className="text-[10px] text-purple-400 block uppercase font-extrabold tracking-wider">Betaal whispers:</strong>
                      <span className="leading-relaxed">{betaalBubbleText}</span>
                    </div>
                    {/* Tiny bubble triangle indicator */}
                    <div className="absolute -bottom-1.5 left-12 w-3 h-3 bg-purple-950 border-r border-b border-purple-800 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="md:col-span-4 flex flex-col items-center justify-center py-2">
                <div 
                  onClick={handleBetaalClick}
                  className="relative group cursor-pointer"
                  title="Click Betaal to hear him cackle and speak!"
                >
                  {/* Glowing background dynamic portal */}
                  <div className={`absolute inset-0 rounded-full blur-xl opacity-30 transition-all duration-700 ${
                    isBetaalCackling 
                      ? 'bg-rose-500 scale-125 animate-ping' 
                      : burden > 75 
                      ? 'bg-red-500 scale-110' 
                      : burden > 40 
                      ? 'bg-purple-500 scale-100' 
                      : 'bg-indigo-500 scale-90'
                  }`} />

                  {/* Pulsing visual halo ring */}
                  <div className={`absolute -inset-1.5 rounded-full border border-dashed transition-all duration-500 ${
                    isBetaalCackling ? 'border-rose-400 animate-spin' : 'border-indigo-500/20 group-hover:border-indigo-400/40'
                  }`} style={{ animationDuration: '6s' }} />

                  <svg 
                    className={`w-28 h-28 relative z-10 transition-transform duration-300 ${
                      isBetaalCackling ? 'scale-110 animate-bounce' : 'group-hover:scale-105 active:scale-95'
                    }`} 
                    viewBox="0 0 100 100"
                  >
                    <defs>
                      <radialGradient id="portal-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={isBetaalCackling ? "#4c0519" : burden > 75 ? "#450a0a" : "#020617"} />
                        <stop offset="100%" stopColor="#020617" />
                      </radialGradient>
                      <linearGradient id="vortex-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Outer portal circle */}
                    <circle cx="50" cy="50" r="46" fill="url(#portal-grad)" stroke="#1e293b" strokeWidth="1.5" />

                    {/* Spiraling Energy Grid of Karma */}
                    <motion.circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="none" 
                      stroke="url(#vortex-grad)" 
                      strokeWidth="1.2" 
                      strokeDasharray="4 8"
                      animate={{ rotate: 360 }}
                      transition={{ 
                        duration: isBetaalCackling ? 3 : burden > 75 ? 8 : 16, 
                        repeat: Infinity, 
                        ease: "linear" 
                      }}
                      className="origin-center"
                    />

                    {/* Animated little stars */}
                    <motion.circle cx="25" cy="30" r="1" fill="#fff" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
                    <motion.circle cx="75" cy="35" r="1.2" fill="#a5b4fc" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.7 }} />
                    <motion.circle cx="35" cy="70" r="1" fill="#e9d5ff" animate={{ opacity: [0.1, 0.8, 0.1] }} transition={{ duration: 1.8, repeat: Infinity, delay: 1.1 }} />
                    <motion.circle cx="68" cy="72" r="0.8" fill="#fff" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />

                    {/* The whole character group including King Vikram & Betaal */}
                    <motion.g 
                      animate={{ 
                        y: isBetaalCackling 
                          ? [0, -4, 2, -2, 0] 
                          : burden > 75 
                          ? [1.5, -1.5, 1.5] 
                          : burden > 40 
                          ? [0.8, -0.8, 0.8] 
                          : [0, 0]
                      }}
                      transition={{ 
                        duration: isBetaalCackling ? 0.4 : 1.2, 
                        repeat: isBetaalCackling ? 2 : Infinity,
                        ease: "easeInOut"
                      }}
                      className="origin-center"
                    >
                      {/* Vikram's Legs - dynamic bending based on heavy burden */}
                      {/* Left Leg */}
                      <path 
                        d={burden > 75 
                          ? "M 40,80 L 32,88 L 24,98" 
                          : burden > 40 
                          ? "M 40,80 L 34,92 L 26,98" 
                          : "M 40,80 L 35,98 L 28,98"
                        } 
                        stroke="#7c2d12" 
                        strokeWidth="5.5" 
                        strokeLinecap="round" 
                        fill="none" 
                        className="transition-all duration-300"
                      />
                      {/* Right Leg */}
                      <path 
                        d={burden > 75 
                          ? "M 50,80 L 56,86 L 64,96" 
                          : burden > 40 
                          ? "M 50,80 L 54,90 L 61,96" 
                          : "M 50,80 L 53,96 L 60,96"
                        } 
                        stroke="#7c2d12" 
                        strokeWidth="5.5" 
                        strokeLinecap="round" 
                        fill="none" 
                        className="transition-all duration-300"
                      />

                      {/* Vikram's body coat - leans forward under weight */}
                      <motion.g
                        animate={{
                          rotate: isBetaalCackling ? [0, -3, 3, -1, 0] : [0, -burden / 15, 0]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="origin-[45px_80px]"
                      >
                        {/* Red Coat */}
                        <path d="M 32,45 L 58,45 L 54,82 L 36,82 Z" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />
                        
                        {/* Vikram's Head */}
                        <circle cx="45" cy="35" r="7.5" fill="#f97316" />
                        
                        {/* Vikram's Royal Golden Crown */}
                        <path d="M 37,29 L 45,18 L 53,29 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                        <circle cx="45" cy="17" r="1.5" fill="#ef4444" />
                        
                        {/* Betaal (The Corpse Ghost) on back */}
                        <motion.g 
                          opacity={burden / 100 + 0.25}
                          animate={{
                            y: isBetaalCackling ? [-1, 2, -2, 1, 0] : [0, -1.2, 0],
                            x: isBetaalCackling ? [-2, 2, -1, 1, 0] : [0, 0]
                          }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                          className="origin-[45px_24px]"
                        >
                          {/* Ghost glowing aura */}
                          <circle cx="45" cy="24" r="8" fill={isBetaalCackling ? "rgba(239,68,68,0.2)" : "rgba(129,140,248,0.15)"} className="blur-xs animate-pulse" />

                          {/* Ghost shoulders/cape */}
                          <path d="M 30,30 Q 45,25 60,30" stroke={isBetaalCackling ? "#fecdd3" : "#cbd5e1"} strokeWidth="3" fill="none" />
                          
                          {/* Ghost Head */}
                          <circle cx="45" cy="24" r="5" fill={isBetaalCackling ? "#ffe4e6" : "#e2e8f0"} stroke={isBetaalCackling ? "#fda4af" : "#94a3b8"} strokeWidth="0.8" />
                          
                          {/* Glowing Eyes */}
                          <circle cx="43" cy="24" r="0.8" fill={isBetaalCackling ? "#ff0000" : "#ef4444"} />
                          <circle cx="47" cy="24" r="0.8" fill={isBetaalCackling ? "#ff0000" : "#ef4444"} />
                          
                          {/* Left Arm grabbing Vikram's neck */}
                          <path d="M 38,28 L 28,45" stroke={isBetaalCackling ? "#fecdd3" : "#cbd5e1"} strokeWidth="2.5" strokeLinecap="round" />
                          
                          {/* Right Arm grabbing Vikram's neck */}
                          <path d="M 52,28 L 62,45" stroke={isBetaalCackling ? "#fecdd3" : "#cbd5e1"} strokeWidth="2.5" strokeLinecap="round" />
                          
                          {/* Ghost tiny horns or crown spikes to look spookier */}
                          <path d="M 42,19 L 41,17 L 43,19 M 48,19 L 49,17 L 47,19" stroke={isBetaalCackling ? "#ef4444" : "#94a3b8"} strokeWidth="1" />
                        </motion.g>
                      </motion.g>
                    </motion.g>
                  </svg>

                  {/* Micro Hint text under SVG */}
                  <div className="text-center mt-1">
                    <span className="text-[8px] font-mono text-indigo-400 group-hover:text-indigo-300 tracking-wider uppercase animate-pulse">
                      ⚡ CLICK TO AWAKEN 💀
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-8">
                <span className="text-[8px] font-mono uppercase bg-indigo-950/40 text-indigo-300 border border-indigo-900/50 px-2 py-0.5 rounded">
                  Graveyard Chronicles
                </span>
                <p className="text-xs text-slate-300 italic mt-1 leading-relaxed">
                  "{status.text}"
                </p>
                <div className="mt-3 border-t border-slate-900/80 pt-2.5">
                  <span className="text-[9px] font-mono text-purple-400 font-bold block uppercase">💀 Betaal whispers:</span>
                  <p className="text-xs text-purple-300 mt-0.5 font-sans leading-snug">
                    "{status.betaal}"
                  </p>
                </div>
              </div>
            </div>

            {/* Royal Vow Submit */}
            <form onSubmit={handleVowSubmit} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Declare a study vow (e.g., 'Learn React Hooks tomorrow')"
                value={vowInput}
                onChange={(e) => setVowInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/30 font-mono placeholder:text-slate-600"
              />
              <button 
                type="submit"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-slate-100 text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300" /> TAKE VOW
              </button>
            </form>
          </div>

          {/* Interactive Story Chronicles map */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-3.5 flex items-center gap-2">
              <Scroll className="w-4 h-4 text-amber-400" /> The 24 Chronicles of Vetala
            </h3>

            {/* Winding trail path */}
            <div className="flex justify-between items-center bg-slate-950 border border-slate-900 rounded-xl p-4.5 mb-5 overflow-x-auto gap-4 scrollbar-none">
              {CHRONICLES.map((chap) => {
                const isSelected = activeChapterId === chap.id;
                const isSolved = solvedChapters.includes(chap.id);
                return (
                  <button
                    key={chap.id}
                    onClick={() => {
                      setActiveChapterId(chap.id);
                      setSelectedAnswer(null);
                      setRiddleResult(null);
                    }}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer min-w-[110px] ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : isSolved
                        ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <div className="relative">
                      {isSolved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <MapPin className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                      )}
                      <span className="absolute -top-1 -right-1 text-[8px] bg-slate-950 px-1 rounded-full border border-slate-800 font-mono">
                        {chap.id}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold truncate max-w-[90px]">
                      Story {chap.id}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Chapter details */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-3 mb-3.5">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  📖 Chapter {currentChapter.id}: {currentChapter.title}
                </span>
                {solvedChapters.includes(currentChapter.id) && (
                  <span className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                    Resolved
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
                {currentChapter.synopsis}
              </p>

              {/* Riddle card */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 mb-4">
                <span className="text-[9px] font-mono text-purple-400 font-bold block uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" /> Vetala's Riddle:
                </span>
                <p className="text-xs text-slate-200 font-semibold mb-3">
                  {currentChapter.riddle}
                </p>

                <div className="flex flex-col gap-2">
                  {currentChapter.options.map((opt, idx) => {
                    const isSelected = selectedAnswer === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedAnswer(idx)}
                        className={`text-left p-2.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-500/10 border-indigo-500 text-slate-100 font-bold'
                            : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                        }`}
                      >
                        <span className="inline-block w-5 text-indigo-400 font-bold">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit panel */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-[10px] font-mono text-slate-500">
                  Reward: <strong className="text-amber-400 font-bold">+20 Karma Points</strong> & "{currentChapter.resolvedBonus}"
                </div>

                <div className="flex items-center gap-2">
                  {riddleResult && (
                    <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
                      riddleResult === 'correct' 
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                    }`}>
                      {riddleResult === 'correct' ? "✨ Correct Judgement!" : "☠️ Wrong Answer!"}
                    </span>
                  )}
                  <button
                    onClick={() => handleAnswerSubmit(currentChapter)}
                    disabled={selectedAnswer === null}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-slate-100 text-xs font-mono font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Submit Judgement
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (5 COLS): Spinning Astrolabe of Wills - BIG & INTERACTIVE */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <div 
            id="glorious-astrolabe-wheel-card"
            className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center shadow-[inset_0_4px_30px_rgba(0,0,0,0.5)]"
          >
            {/* Dynamic neon atmospheric light shifting based on land/spin */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[80px] pointer-events-none transition-all duration-1000 opacity-20"
              style={{
                background: spinResult 
                  ? `radial-gradient(circle, ${spinResult.hex} 0%, transparent 70%)` 
                  : `radial-gradient(circle, #6366f1 0%, transparent 70%)`
              }}
            />

            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-1 flex items-center gap-2 self-start">
              <RefreshCw className="w-4 h-4 text-cyan-400" /> Astrolabe of Seven Wills
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed self-start">
              Attune your active spiritual frequency. Spin the massive wheel to align your state with eternal cosmic virtues!
            </p>

            {/* Giant Spinning Wheel Stage */}
            <div className="relative w-72 h-72 sm:w-80 h-80 flex items-center justify-center my-6 select-none">
              
              {/* Outer decorative dial teeth rings */}
              <div className="absolute inset-0 rounded-full border-[6px] border-slate-900 bg-slate-950 shadow-[0_0_35px_rgba(99,102,241,0.15),_inset_0_4px_20px_rgba(0,0,0,0.8)] z-0" />
              
              {/* Metal golden pins represent tactile click-stoppers */}
              {[...Array(28)].map((_, i) => {
                const angle = i * (360 / 28);
                return (
                  <div 
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border border-slate-950 z-10"
                    style={{
                      transform: `rotate(${angle}deg) translateY(-145px)`,
                      transformOrigin: 'center center'
                    }}
                  />
                );
              })}

              {/* Rotating inner wheel of fate */}
              <motion.div
                animate={{ rotate: wheelRotation }}
                transition={{
                  duration: 2.5,
                  ease: [0.25, 0.1, 0.1, 1.0] // smooth organic deceleration curve
                }}
                className="absolute inset-2.5 rounded-full overflow-hidden z-0"
              >
                <svg className="w-full h-full transform origin-center rotate-0" viewBox="0 0 300 300">
                  <defs>
                    {/* Linear color gradients for all slices */}
                    {precomputedSlices.map((slice, idx) => (
                      <linearGradient id={`slice-grad-${idx}`} key={idx} x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#090d16" />
                        <stop offset="65%" stopColor={`${slice.hex}15`} />
                        <stop offset="100%" stopColor={`${slice.hex}40`} />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Wedge Paths */}
                  {precomputedSlices.map((slice, idx) => (
                    <g key={idx} className="group/slice">
                      {/* Colored Segment Path */}
                      <path 
                        d={slice.pathData} 
                        fill={`url(#slice-grad-${idx})`}
                        stroke={`${slice.hex}30`}
                        strokeWidth="1.5"
                      />

                      {/* Concentric border lines to create high-tech ancient blueprint effect */}
                      <path 
                        d={slice.pathData} 
                        fill="none"
                        stroke={`${slice.hex}10`}
                        strokeWidth="6"
                        className="opacity-50"
                      />

                      {/* Virtue labels wrapped inside wedges */}
                      <g transform={`translate(${slice.tx}, ${slice.ty}) rotate(${slice.midAngle + 90})`}>
                        {/* Vector miniature icons inside wheel slice */}
                        <g transform="translate(-10, -32) scale(0.85)">
                          {idx === 0 && <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#818cf8" strokeWidth="2.5" fill="none" />}
                          {idx === 1 && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z m-3-11l2 2 4-4" stroke="#22d3ee" strokeWidth="2.5" fill="none" />}
                          {idx === 2 && <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0" stroke="#fbbf24" strokeWidth="2.5" fill="none" />}
                          {idx === 3 && <path d="M14.5 17.5 3 6V3h3l11.5 11.5 M16 16 20 20" stroke="#f43f5e" strokeWidth="2.5" fill="none" />}
                          {idx === 4 && <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="#34d399" strokeWidth="2.5" fill="none" />}
                          {idx === 5 && <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" stroke="#e879f9" strokeWidth="2.5" fill="none" />}
                          {idx === 6 && <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20" stroke="#2dd4bf" strokeWidth="2.5" fill="none" />}
                        </g>

                        {/* Text characters */}
                        <text 
                          y="10"
                          textAnchor="middle" 
                          fill="#94a3b8" 
                          fontSize="7.5" 
                          fontFamily="monospace"
                          fontWeight="bold"
                          className="tracking-wider uppercase opacity-85 group-hover/slice:fill-white transition-colors"
                        >
                          {slice.name.split(" ")[0]}
                        </text>
                      </g>
                    </g>
                  ))}

                  {/* Golden circular core rim */}
                  <circle cx="150" cy="150" r="32" fill="#020617" stroke="#fbbf24" strokeWidth="3" className="shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]" />
                  <circle cx="150" cy="150" r="25" fill="#090d16" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3, 3" />
                </svg>

                {/* Sparkling core flare */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-10 h-10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-amber-400 fill-amber-500/20 animate-pulse" />
                </div>
              </motion.div>

              {/* Selector needle marker (Pointer at top) with physical elastic wobble */}
              <motion.div 
                animate={{ 
                  rotate: pointerWobble ? [-15, 8, -5, 0] : 0 
                }}
                transition={{ duration: 0.15 }}
                className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-8 h-10 z-20 flex flex-col items-center pointer-events-none"
              >
                {/* Pointer Arrow */}
                <svg className="w-6 h-8 text-amber-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2 L4 22 L12 17 L20 22 Z" />
                </svg>
                {/* Embedded ruby stone */}
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-2.5 animate-ping" />
              </motion.div>

              {/* Holographic scanning overlay ring */}
              <div className="absolute inset-0 rounded-full border border-indigo-500/10 pointer-events-none bg-gradient-to-t from-transparent via-indigo-500/2 to-transparent z-10" />
            </div>

            {/* Spin Trigger Button */}
            <button
              id="wheel-spin-trigger-btn"
              onClick={handleSpinWheel}
              disabled={isSpinning}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-slate-100 text-xs font-mono font-bold py-3.5 px-5 rounded-2xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-[0.98] disabled:opacity-45 cursor-pointer flex items-center justify-center gap-2 z-10 uppercase tracking-widest mt-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              {isSpinning ? "Tuning Gravitational Strings..." : "Spin the Astrolabe"}
            </button>

            {/* In-Card static quick feedback of the active attunement */}
            {spinResult && !showRewardModal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full mt-4 bg-slate-950/90 border border-slate-900 rounded-xl p-3 text-center border-indigo-500/20"
              >
                <span className="text-[8px] font-mono uppercase text-slate-500 block tracking-widest">
                  Active Attunement frequency
                </span>
                <p className="text-xs font-bold text-indigo-400 font-mono mt-0.5 uppercase tracking-wide">
                  {spinResult.name}
                </p>
                <span className="text-[9px] text-slate-400 font-mono italic block mt-0.5">
                  ⚡ {spinResult.effect}
                </span>
              </motion.div>
            )}
          </div>

          {/* Wisdom Checklist Card */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> Wisdom Achievements Checklist
            </h4>
            
            <div className="flex flex-col gap-2.5 mt-3 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${solvedChapters.length > 0 ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={solvedChapters.length > 0 ? 'text-slate-300' : ''}>Solve at least 1 Vetala story riddle</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${spinResult ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={spinResult ? 'text-slate-300' : ''}>Spin the Astrolabe to align with your fate</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${burden === 0 ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={burden === 0 ? 'text-slate-300' : ''}>Lighten your burden completely to 0 kg</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* FULL SCREEN REWARD MODAL OVERLAY (WOW EXCITING POPUP) */}
      <AnimatePresence>
        {showRewardModal && spinResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              style={{
                boxShadow: `0 0 40px -10px ${spinResult.hex}40, inset 0 1px 1px rgba(255,255,255,0.1)`
              }}
            >
              {/* Star sparkles background inside modal */}
              <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
              <div className="absolute top-4 right-4 pointer-events-none animate-pulse">
                <Sparkle className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="absolute bottom-12 left-4 pointer-events-none animate-pulse">
                <Sparkle className="w-4 h-4 text-purple-400" />
              </div>

              {/* Core interactive illustration */}
              <div className="flex flex-col items-center text-center mt-3">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 relative transition-transform duration-500 hover:scale-110"
                  style={{
                    background: `radial-gradient(circle, ${spinResult.hex}25 0%, #0c0f1d 100%)`,
                    border: `2px solid ${spinResult.hex}50`,
                    boxShadow: `0 0 25px ${spinResult.hex}35`
                  }}
                >
                  {/* Glowing core halo */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
                  
                  {/* Vector Markup Icon for selected virtue */}
                  {spinResult.iconMarkup}

                  {/* Pulsing beacon points */}
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: spinResult.hex }} />
                </div>

                <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest font-bold">
                  🔮 Graveyard Fate Aligned 🔮
                </span>

                <h3 className="text-xl font-serif font-bold text-slate-100 uppercase tracking-wide mt-1.5">
                  {spinResult.name} Attunement
                </h3>

                {/* Karma boost indicator */}
                <div className="mt-3.5 px-4.5 py-1.5 rounded-full bg-slate-950 border border-slate-900 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-500/25 animate-spin" />
                  <span className="text-emerald-400">+25 Karma Points</span> Granted
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-5 px-2">
                  {spinResult.desc}
                </p>

                {/* Virtue Action Bonus box */}
                <div className="w-full mt-6 bg-slate-950 border border-slate-900 rounded-2xl p-4 text-left">
                  <span className="text-[8.5px] font-mono text-slate-500 uppercase block tracking-wider">
                    Sovereign Active Blessing
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-500/10 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 font-mono">{spinResult.effect}</span>
                  </div>
                </div>

                {/* Narrative quote */}
                <p className="text-[10.5px] text-slate-500 italic font-sans mt-4 max-w-[280px]">
                  "Vikram's shoulders stand firm. The cosmic astrolabe confirms your unyielding focus on pure Satya and state diligence."
                </p>

                {/* Interactive button to close popup */}
                <button
                  onClick={() => setShowRewardModal(false)}
                  className="w-full mt-7 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-slate-100 text-xs font-mono font-semibold py-3 px-5 rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_22px_rgba(99,102,241,0.5)] active:scale-[0.97] cursor-pointer"
                >
                  Receive Royal Attunement
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
