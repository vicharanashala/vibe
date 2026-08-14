import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Flame, Wind, MessageSquare, Trees, HelpCircle, Eye } from 'lucide-react';
import { UserStreakState } from '../types';
import { audioSynthesizer } from '../utils/audioSynthesizer';

interface MythologicalForestProps {
  state: UserStreakState;
  triggerNotification: (message: string, type: 'success' | 'info' | 'badge') => void;
}

// Wisdom whispers from the ancient forest canopy
const FOREST_WHISPERS = [
  "🌳 Peepal (Aswatha): 'I am the eternal tree with roots above and branches below. Every leaf of mine is a verse of discipline.'",
  "🍃 Banyan (Nyagrodha): 'My aerial roots reach back to the earth, just as your daily habits anchor your ultimate destiny.'",
  "🌸 Kadamba: 'Associated with divine playfulness and sweet surrender. Let thy efforts blossom in silence, untroubled by the fruit.'",
  "🌿 Parijata (Night Jasmine): 'My flowers fall at dawn, yet fill the forest with sweet incense. True learning leaves an unspoken fragrance.'",
  "🎋 Sacred Bamboo: 'Bending gracefully under the fierce storm, yet never breaking. Such is the resilience of an unbroken streak.'",
  "🪵 Ashoka Tree: 'The remover of sorrow. To walk in my shade is to leave anxiety behind and find calm in consecutive focus.'"
];

export function MythologicalForest({ state, triggerNotification }: MythologicalForestProps) {
  const [activeWhisper, setActiveWhisper] = useState(FOREST_WHISPERS[0]);
  const [fireflies, setFireflies] = useState<{ id: number; x: number; y: number; delay: number; scale: number }[]>([]);
  const [fallingLeaves, setFallingLeaves] = useState<{ id: number; x: number; y: number; rotate: number; speed: number; size: number }[]>([]);
  const [isFireflyPortalActive, setIsFireflyPortalActive] = useState(true);
  const [hoveredLeaf, setHoveredLeaf] = useState<number | null>(null);

  // Generate falling leaves and fireflies
  useEffect(() => {
    // Generate 12 ambient floating fireflies
    const newFireflies = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 90 + 5,
      y: Math.random() * 80 + 10,
      delay: Math.random() * 5,
      scale: Math.random() * 0.6 + 0.4,
    }));
    setFireflies(newFireflies);

    // Generate 8 drifting leaves
    const newLeaves = Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      x: Math.random() * 80 + 10,
      y: -10 - (Math.random() * 20),
      rotate: Math.random() * 360,
      speed: Math.random() * 4 + 3,
      size: Math.random() * 14 + 10,
    }));
    setFallingLeaves(newLeaves);
  }, []);

  // Frame animation for falling leaves within the card bounds
  useEffect(() => {
    if (!isFireflyPortalActive) return;

    const interval = setInterval(() => {
      setFallingLeaves((prev) =>
        prev.map((leaf) => {
          let newY = leaf.y + (leaf.speed * 0.25);
          let newX = leaf.x + Math.sin(newY / 15) * 0.8; // beautiful swaying drift
          
          if (newY > 110) {
            newY = -15;
            newX = Math.random() * 90 + 5;
          }
          return { ...leaf, y: newY, x: newX, rotate: leaf.rotate + 0.5 };
        })
      );
    }, 45);

    return () => clearInterval(interval);
  }, [isFireflyPortalActive]);

  // Determine tree stage based on current streak
  const streak = state.currentStreak;
  let stageTitle = "Glowing Mystical Seedling";
  let stageDesc = "A tiny sprout drinking the starlight of your early resolve.";
  let foliageColor = "text-emerald-500/80";
  let leavesCount = 8;
  let treeIcon = "🌱";
  let trunkHeight = "h-4";
  let canopyWidth = "w-16";

  if (streak >= 15) {
    stageTitle = "Sacred Kalpavriksha (Wishing Tree)";
    stageDesc = "The divine tree of legend! Cosmic stars blossom in your branches, fueled by 15+ days of unbroken vow.";
    foliageColor = "text-amber-400";
    leavesCount = 28;
    treeIcon = "🌟🌳✨";
    trunkHeight = "h-20";
    canopyWidth = "w-52";
  } else if (streak >= 8) {
    stageTitle = "Ancient Sacred Banyan";
    stageDesc = "Mighty, aerial-rooted giant. The very tree where Betaal cackles with riddle wisdom.";
    foliageColor = "text-teal-400";
    leavesCount = 20;
    treeIcon = "🌳";
    trunkHeight = "h-16";
    canopyWidth = "w-44";
  } else if (streak >= 4) {
    stageTitle = "Spiritual Peepal Tree";
    stageDesc = "A thriving sacred grove tree, rustling in the midnight wind of discipline.";
    foliageColor = "text-emerald-400";
    leavesCount = 14;
    treeIcon = "🌿";
    trunkHeight = "h-10";
    canopyWidth = "w-28";
  }

  // Handle interacting with the tree to rustle leaves & fetch wisdom
  const handleRustleTree = () => {
    // Generate dynamic wood flute sound if sound is enabled
    if (audioSynthesizer.getIsEnabled()) {
      audioSynthesizer.playMilestoneChime();
    }
    
    // Pick a new random whisper
    const currentIdx = FOREST_WHISPERS.indexOf(activeWhisper);
    let nextIdx = Math.floor(Math.random() * FOREST_WHISPERS.length);
    if (nextIdx === currentIdx) {
      nextIdx = (nextIdx + 1) % FOREST_WHISPERS.length;
    }
    setActiveWhisper(FOREST_WHISPERS[nextIdx]);
    
    triggerNotification("🍃 You rustled the sacred canopy! The leaves whisper ancient botanical wisdom.", "info");
  };

  // Trigger sound effect on hovering individual leaves
  const handleLeafHover = (id: number) => {
    setHoveredLeaf(id);
  };

  return (
    <div id="mythological-forest-chamber" className="mb-8">
      <div className="relative bg-gradient-to-b from-emerald-950/25 via-slate-900/35 to-indigo-950/15 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-6 shadow-[0_0_35px_-5px_rgba(16,185,129,0.15)] overflow-hidden">
        
        {/* Canopy Forest background mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent pointer-events-none" />

        {/* 1. Interactive Falling Leaves overlay container */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {isFireflyPortalActive && fallingLeaves.map((leaf) => (
            <div
              key={leaf.id}
              className="absolute text-emerald-400/30 transition-all duration-75"
              style={{
                left: `${leaf.x}%`,
                top: `${leaf.y}%`,
                transform: `rotate(${leaf.rotate}deg)`,
                fontSize: `${leaf.size}px`,
              }}
            >
              🍃
            </div>
          ))}

          {/* Glowing fireflies */}
          {isFireflyPortalActive && fireflies.map((ff) => (
            <div
              key={ff.id}
              className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[1px] animate-pulse pointer-events-none"
              style={{
                left: `${ff.x}%`,
                top: `${ff.y}%`,
                animationDelay: `${ff.delay}s`,
                animationDuration: `${1.5 + ff.scale * 2}s`,
                opacity: ff.scale * 0.8,
                transform: `scale(${ff.scale})`,
                boxShadow: '0 0 8px 2px rgba(234, 179, 8, 0.4)',
              }}
            />
          ))}
        </div>

        {/* Header Title with Forest Vibes */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-emerald-950">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Trees className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-slate-100 tracking-wide flex items-center gap-2">
                Betaal's Whispering Sacred Grove
              </h2>
              <p className="text-xs text-emerald-400/80 font-mono">
                Your Streak Canopy: Stage grows with consecutive resolve
              </p>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                setIsFireflyPortalActive(!isFireflyPortalActive);
                triggerNotification(
                  isFireflyPortalActive ? "🍂 Forest wind stilled. Firefly portal closed." : "✨ Magic wind rustles. Firefly portal opened!",
                  "info"
                );
              }}
              className={`px-3 py-1.5 border text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                isFireflyPortalActive
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wind className={`w-3.5 h-3.5 ${isFireflyPortalActive ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              {isFireflyPortalActive ? "Wind: ACTIVE" : "Wind: SILENT"}
            </button>
          </div>
        </div>

        {/* Tree Display & Canopy growth section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Left Panel: The Sacred Tree Representation */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center min-h-[240px] bg-slate-950/60 rounded-2xl border border-emerald-950/50 p-6 relative group overflow-hidden">
            
            {/* Background glowing canopy */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] opacity-20 transition-all duration-1000 ${
              streak >= 15 ? 'bg-amber-500/30' : streak >= 8 ? 'bg-teal-500/30' : 'bg-emerald-500/30'
            }`} />

            {/* Tap cue overlay */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-900/80 border border-slate-800 px-2 py-1 rounded-lg text-[9px] text-emerald-400 font-mono animate-bounce cursor-pointer" onClick={handleRustleTree}>
              <Flame className="w-3 h-3 text-amber-500" /> Rustle Canopy
            </div>

            {/* Tree Growth visualizer using absolute SVG styling */}
            <div 
              className="relative flex flex-col items-center justify-end h-56 cursor-pointer select-none"
              onClick={handleRustleTree}
              title="Click to rustle leaves and generate forest wisdom"
            >
              {/* Dynamic Canopy Leaves */}
              <div className="relative z-10 flex flex-col items-center">
                {/* Stage emoji or particle bursts */}
                <div className="text-5xl md:text-6xl transition-all duration-700 hover:scale-110 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  {treeIcon}
                </div>

                {/* Simulated customizable floating leaves representing days of streak */}
                <div className="absolute -inset-10 pointer-events-none flex items-center justify-center">
                  {Array.from({ length: leavesCount }).map((_, i) => {
                    const angle = (i / leavesCount) * Math.PI * 2;
                    const radiusX = streak >= 15 ? 48 : streak >= 8 ? 38 : 24;
                    const radiusY = streak >= 15 ? 36 : streak >= 8 ? 28 : 18;
                    const x = Math.cos(angle) * radiusX;
                    const y = Math.sin(angle) * radiusY - 20;

                    return (
                      <motion.div
                        key={i}
                        animate={{ 
                          y: [y, y - 4, y],
                          rotate: [0, 8, -8, 0]
                        }}
                        transition={{
                          duration: 3 + (i % 3),
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.15
                        }}
                        onMouseEnter={() => handleLeafHover(i)}
                        onMouseLeave={() => setHoveredLeaf(null)}
                        className={`absolute w-3 h-3 rounded-full flex items-center justify-center text-xs transition-transform duration-300 ${
                          hoveredLeaf === i ? 'scale-150 z-20 text-yellow-300' : 'text-emerald-400/80'
                        }`}
                        style={{
                          transform: `translate(${x}px, ${y}px)`,
                        }}
                      >
                        🍁
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Trunk & Soil Base */}
              <div className={`w-4 bg-amber-900/60 rounded-t-lg transition-all duration-700 ${trunkHeight}`} />
              <div className="w-24 h-3 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border border-emerald-800/40 rounded-full shadow-inner flex items-center justify-center">
                <div className="w-16 h-1 bg-amber-500/30 rounded-full animate-pulse" />
              </div>

              <span className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-widest">
                Streak Level: {streak} days
              </span>
            </div>

            {/* Glowing active banner */}
            <div className="mt-4 text-center">
              <h3 className="text-base font-serif font-bold text-slate-200">
                {stageTitle}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                {stageDesc}
              </p>
            </div>
          </div>

          {/* Right Panel: Whispers of the Wood & Forest Stats */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* The Whispering scroll */}
            <div className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-5 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 bg-emerald-500/10 rounded-bl-xl text-[8px] font-mono uppercase text-emerald-400 tracking-widest font-bold flex items-center gap-1">
                <MessageSquare className="w-2.5 h-2.5" /> Voice of the Grove
              </div>
              
              <h4 className="text-xs font-serif font-bold text-emerald-400 tracking-wider uppercase mb-3 flex items-center gap-1">
                🌲 Canopy Whispers
              </h4>

              <div className="min-h-[80px] flex flex-col justify-center">
                <p className="text-xs md:text-sm italic font-serif leading-relaxed text-emerald-100/90 pl-3 border-l-2 border-emerald-500/40 py-1">
                  {activeWhisper}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-950/60 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Touch the tree trunk or canopy to rustle leaves.</span>
                <button 
                  onClick={handleRustleTree}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold transition-all flex items-center gap-1"
                >
                  Rustle Leaf <Sparkles className="w-3 h-3 text-amber-500" />
                </button>
              </div>
            </div>

            {/* Forest botanical facts & eco-karmic synergy */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
                🌳 Eco-Karmic Synergy Logs
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                In Indian mythological texts, trees are considered conscious beings that hold spiritual records. Unlocking knowledge streak badges releases spiritual oxygen into the Vibe Forest.
              </p>
              
              {/* Streaks metrics */}
              <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl">
                  <span className="text-[9px] text-slate-500 uppercase">Tree Canopy Health</span>
                  <p className="text-sm font-bold text-emerald-400 mt-1">
                    {Math.min(100, Math.max(10, streak * 6.5))}% Vibrant
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl">
                  <span className="text-[9px] text-slate-500 uppercase">Starlight Fireflies</span>
                  <p className="text-sm font-bold text-amber-400 mt-1">
                    {isFireflyPortalActive ? '15 Active' : 'Sealed'}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
