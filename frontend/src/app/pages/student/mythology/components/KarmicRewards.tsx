import React, { useState } from 'react';
import { Sparkles, ShieldAlert, BadgeCheck, Flame, Play, Volume2, Coins, Snowflake, AlertCircle, Sparkle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserStreakState } from '../types';

export interface FlairItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  styleClass: string;
  badgeText: string;
}

export const FLAIR_ITEMS: FlairItem[] = [
  {
    id: "neophyte",
    name: "The Neophyte",
    cost: 0,
    description: "A fresh apprentice starting their quest for digital enlightenment.",
    styleClass: "bg-slate-900 border-slate-800 text-slate-400",
    badgeText: "🌱 Neophyte"
  },
  {
    id: "enlightened",
    name: "The Enlightened",
    cost: 100,
    description: "Your aura burns with dedication. Emits a warm amber solar glow.",
    styleClass: "bg-amber-950/20 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
    badgeText: "✨ The Enlightened"
  },
  {
    id: "sage",
    name: "Sovereign Sage",
    cost: 250,
    description: "An esteemed scholar of the court. Shimmers with an active pulsing indigo fire.",
    styleClass: "bg-indigo-950/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse",
    badgeText: "👑 Sovereign Sage"
  },
  {
    id: "companion",
    name: "Betaal's Companion",
    cost: 400,
    description: "You have spent nights in the crematorium. Shrouded in deep violet-rose ghostly flames.",
    styleClass: "bg-rose-950/20 border-rose-500/60 text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.35)] font-serif font-bold tracking-widest",
    badgeText: "💀 Betaal's Companion"
  },
  {
    id: "weaver",
    name: "Space-Time Weaver",
    cost: 550,
    description: "You manipulate temporal simulators at will. Glows with shifting cyan-fuchsia hyper-dimensional stardust.",
    styleClass: "bg-gradient-to-r from-cyan-950/30 to-purple-950/30 border-cyan-400/50 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-fuchsia-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)]",
    badgeText: "🌀 Space-Time Weaver"
  }
];

export interface DifficultyItem {
  id: 'mortal' | 'siddha' | 'yaksha';
  name: string;
  cost: number;
  description: string;
  xpBonusText: string;
  bonusPercent: number;
  styleClass: string;
  unlockedByDefault: boolean;
}

export const DIFFICULTY_ITEMS: DifficultyItem[] = [
  {
    id: 'mortal',
    name: "Mortal (Easy)",
    cost: 0,
    description: "Betaal poses direct challenges. Generates highly descriptive riddle scrolls.",
    xpBonusText: "Standard Rewards",
    bonusPercent: 0,
    styleClass: "border-slate-800 text-slate-300 bg-slate-900/40",
    unlockedByDefault: true
  },
  {
    id: 'siddha',
    name: "Siddha (Medium)",
    cost: 150,
    description: "Betaal speaks in intricate metaphors and advanced computer architecture logic traps.",
    xpBonusText: "+15% Karma Points",
    bonusPercent: 15,
    styleClass: "border-indigo-500/25 text-indigo-300 bg-indigo-950/5 shadow-[0_0_12px_rgba(99,102,241,0.08)]",
    unlockedByDefault: false
  },
  {
    id: 'yaksha',
    name: "Yaksha (Hard)",
    cost: 300,
    description: "The trial of kings. Complex riddle structures laced with dense Sanskrit lore and algorithmic queries.",
    xpBonusText: "+35% Karma Points",
    bonusPercent: 35,
    styleClass: "border-amber-500/25 text-amber-300 bg-amber-950/5 shadow-[0_0_15px_rgba(245,158,11,0.12)]",
    unlockedByDefault: false
  }
];

interface KarmicRewardsProps {
  state: UserStreakState;
  onChangeState: (updater: (prev: UserStreakState) => UserStreakState) => void;
  onNotify: (message: string, type: 'success' | 'info' | 'badge') => void;
}

export const KarmicRewards: React.FC<KarmicRewardsProps> = ({ state, onChangeState, onNotify }) => {
  const [activeTab, setActiveTab] = useState<'flair' | 'difficulty' | 'freeze'>('flair');
  const karma = state.karmaPoints;
  
  // Safely fallback new state properties
  const unlockedFlairs = state.unlockedFlairs || ["neophyte"];
  const activeFlair = state.activeFlair || "neophyte";
  const streakFreezes = state.streakFreezes || 0;
  const riddleDifficulty = state.riddleDifficulty || "mortal";
  
  // Custom state for locking in extra purchase animations
  const [purchaseGlow, setPurchaseGlow] = useState<string | null>(null);

  // Play magical purchase bells using Web Audio API
  const playPurchaseSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Warm low frequency base chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(147.14, now); // D3
      osc1.frequency.exponentialRampToValueAtTime(220, now + 0.4);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // High-pitched crystal bells arpeggio (C Major / G Major mix)
      const notes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const delay = idx * 0.06;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.5);
      });
      
      osc1.start(now);
      osc1.stop(now + 0.5);
    } catch (err) {
      console.warn("Audio Context blocked or not supported:", err);
    }
  };

  const playEquipSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.setValueAtTime(440.00, now + 0.08); // A4
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (err) {}
  };

  const handleBuyFlair = (flair: FlairItem) => {
    if (karma < flair.cost) {
      onNotify(`❌ Insufficient Karmic Balance! You need ${flair.cost - karma} more KP.`, 'info');
      return;
    }

    setPurchaseGlow(flair.id);
    setTimeout(() => setPurchaseGlow(null), 1000);

    onChangeState(prev => ({
      ...prev,
      karmaPoints: prev.karmaPoints - flair.cost,
      unlockedFlairs: [...(prev.unlockedFlairs || ['neophyte']), flair.id],
      activeFlair: flair.id
    }));

    playPurchaseSound();
    onNotify(`✨ Success! Unlocked and equipped "${flair.name}" Profile Flair!`, 'success');
  };

  const handleEquipFlair = (flairId: string) => {
    onChangeState(prev => ({
      ...prev,
      activeFlair: flairId
    }));
    playEquipSound();
    const fl = FLAIR_ITEMS.find(f => f.id === flairId);
    onNotify(`🔮 Equipped Flair: "${fl?.name || flairId}"`, 'success');
  };

  const handleBuyDifficulty = (difficulty: DifficultyItem) => {
    if (karma < difficulty.cost) {
      onNotify(`❌ Insufficient Karmic Balance! You need ${difficulty.cost - karma} more KP.`, 'info');
      return;
    }

    setPurchaseGlow(difficulty.id);
    setTimeout(() => setPurchaseGlow(null), 1000);

    onChangeState(prev => ({
      ...prev,
      karmaPoints: prev.karmaPoints - difficulty.cost,
      unlockedFlairs: [...(prev.unlockedFlairs || ['neophyte']), `diff-${difficulty.id}`],
      riddleDifficulty: difficulty.id
    }));

    playPurchaseSound();
    onNotify(`🔥 Success! Unlocked and equipped "${difficulty.name}" Riddle Difficulty setting!`, 'success');
  };

  const handleEquipDifficulty = (diffId: 'mortal' | 'siddha' | 'yaksha') => {
    onChangeState(prev => ({
      ...prev,
      riddleDifficulty: diffId
    }));
    playEquipSound();
    const df = DIFFICULTY_ITEMS.find(d => d.id === diffId);
    onNotify(`⚔️ Active Challenge set to: "${df?.name}" (${df?.xpBonusText})`, 'success');
  };

  const handleBuyFreeze = () => {
    const cost = 150;
    if (karma < cost) {
      onNotify(`❌ Insufficient Karmic Balance! Sanjeevani Stones cost 150 KP.`, 'info');
      return;
    }

    if (streakFreezes >= 5) {
      onNotify(`⚠️ You cannot carry more than 5 Sanjeevani Stones at once.`, 'info');
      return;
    }

    setPurchaseGlow('freeze-buy');
    setTimeout(() => setPurchaseGlow(null), 1000);

    onChangeState(prev => ({
      ...prev,
      karmaPoints: prev.karmaPoints - cost,
      streakFreezes: (prev.streakFreezes || 0) + 1
    }));

    playPurchaseSound();
    onNotify(`❄️ Acquired 1 Sanjeevani Stone (Streak Freeze)! It will automatically preserve your streak.`, 'success');
  };

  const activeFlairItem = FLAIR_ITEMS.find(f => f.id === activeFlair) || FLAIR_ITEMS[0];

  return (
    <section 
      id="karmic-rewards-bazaar" 
      className="bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-purple-950/60 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.08)] mb-8"
    >
      {/* Decorative Shifting Magic Grid in Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Bazaar Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-500/10 pb-5 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold">
              Sacred Karma Trade
            </span>
            <span className="animate-pulse">💎</span>
          </div>
          <h2 className="text-lg font-serif font-bold text-slate-100 tracking-wider uppercase mt-1 flex items-center gap-2.5">
            🌌 Sacred Karmic Bazaar
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Spend your study Karma Points to secure defensive relics and cosmetics.
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 bg-slate-950/70 border border-indigo-500/15 p-3 rounded-2xl">
          <div className="text-center px-2 border-r border-indigo-500/10 font-mono">
            <span className="text-[8px] text-slate-500 uppercase block">Balance</span>
            <span className="text-sm font-bold text-amber-400 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> {karma} <span className="text-[10px] text-slate-500 font-normal">KP</span>
            </span>
          </div>

          <div className="text-center px-2 border-r border-indigo-500/10 font-mono">
            <span className="text-[8px] text-slate-500 uppercase block">Sanjeevani</span>
            <span className="text-sm font-bold text-cyan-400 flex items-center gap-1 justify-center">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" /> {streakFreezes} <span className="text-[10px] text-slate-500 font-normal">Held</span>
            </span>
          </div>

          <div className="text-center px-2 font-mono">
            <span className="text-[8px] text-slate-500 uppercase block">Equipped Flair</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border inline-block font-bold truncate max-w-[120px] mt-0.5 ${activeFlairItem.styleClass}`}>
              {activeFlairItem.badgeText}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-800 gap-1 mb-6 relative z-10 overflow-x-auto scrollbar-none">
        <button
          onClick={() => { setActiveTab('flair'); playEquipSound(); }}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'flair' 
              ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          ✨ Profile Flairs
        </button>
        <button
          onClick={() => { setActiveTab('difficulty'); playEquipSound(); }}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'difficulty' 
              ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          ⚔️ Riddle Trials
        </button>
        <button
          onClick={() => { setActiveTab('freeze'); playEquipSound(); }}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'freeze' 
              ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          ❄️ Streak Shields
        </button>
      </div>

      {/* Tabs Content */}
      <div className="relative z-10">
        
        {/* TAB 1: PROFILE FLAIRS */}
        {activeTab === 'flair' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FLAIR_ITEMS.map((item) => {
              const isUnlocked = unlockedFlairs.includes(item.id);
              const isActive = activeFlair === item.id;
              const canAfford = karma >= item.cost;
              const isGlow = purchaseGlow === item.id;

              return (
                <motion.div
                  layout
                  key={item.id}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                    isActive 
                      ? 'bg-indigo-950/30 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                      : isUnlocked 
                      ? 'bg-slate-900/50 border-slate-800' 
                      : 'bg-slate-950/50 border-slate-950 opacity-90 hover:opacity-100'
                  } ${isGlow ? 'ring-2 ring-indigo-400 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : ''}`}
                >
                  <div>
                    {/* Item Badge Preview */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${item.styleClass}`}>
                        {item.badgeText}
                      </span>
                      {isActive && (
                        <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          EQUIPPED
                        </span>
                      )}
                      {!isActive && isUnlocked && (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          UNLOCKED
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-serif font-bold text-slate-100 uppercase tracking-wide">
                      {item.name}
                    </h3>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans mt-1.5 min-h-[2.75rem]">
                      {item.description}
                    </p>
                  </div>

                  {/* Buy / Equip Controls */}
                  <div className="border-t border-slate-900 mt-4 pt-3 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">
                      {isUnlocked ? "Cosmetic asset" : "Karmic trade"}
                    </span>

                    {isActive ? (
                      <button 
                        disabled
                        className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold py-1.5 px-3.5 rounded-lg opacity-80"
                      >
                        Active Companion
                      </button>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleEquipFlair(item.id)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-200 text-[10px] font-mono font-bold py-1.5 px-4 rounded-lg cursor-pointer transition-all active:scale-95"
                      >
                        Equip Flair
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyFlair(item)}
                        disabled={!canAfford}
                        className={`flex items-center gap-1.5 text-[10px] font-mono font-bold py-1.5 px-4 rounded-lg transition-all active:scale-95 cursor-pointer ${
                          canAfford 
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                            : 'bg-slate-900 border border-slate-800/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3 h-3" /> {item.cost} KP
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* TAB 2: CHALLENGE DIFFICULTY */}
        {activeTab === 'difficulty' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {DIFFICULTY_ITEMS.map((item) => {
              const isUnlocked = item.unlockedByDefault || unlockedFlairs.includes(`diff-${item.id}`);
              const isActive = riddleDifficulty === item.id;
              const canAfford = karma >= item.cost;
              const isGlow = purchaseGlow === item.id;

              return (
                <motion.div
                  layout
                  key={item.id}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                    isActive 
                      ? 'bg-indigo-950/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                      : isUnlocked 
                      ? 'bg-slate-900/50 border-slate-800' 
                      : 'bg-slate-950/50 border-slate-950 opacity-90'
                  } ${isGlow ? 'ring-2 ring-indigo-400 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : ''}`}
                >
                  <div>
                    {/* Difficulty Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        item.id === 'mortal' 
                          ? 'bg-slate-900 border-slate-800 text-slate-400'
                          : item.id === 'siddha'
                          ? 'bg-indigo-950 border-indigo-500/30 text-indigo-300'
                          : 'bg-amber-950 border-amber-500/30 text-amber-300'
                      }`}>
                        {item.name}
                      </span>
                      
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {item.xpBonusText}
                      </span>
                    </div>

                    <h3 className="text-xs font-serif font-bold text-slate-100 uppercase tracking-wide mt-2.5">
                      {item.name} Path
                    </h3>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans mt-1.5 min-h-[3.25rem]">
                      {item.description}
                    </p>
                  </div>

                  {/* Buy / Equip Controls */}
                  <div className="border-t border-slate-900 mt-4 pt-3 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-500">
                      Riddle engine parameter
                    </span>

                    {isActive ? (
                      <button 
                        disabled
                        className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold py-1.5 px-3.5 rounded-lg opacity-80"
                      >
                        Active Mode
                      </button>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleEquipDifficulty(item.id)}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-slate-500 text-slate-200 text-[10px] font-mono font-bold py-1.5 px-4 rounded-lg cursor-pointer transition-all active:scale-95"
                      >
                        Select Path
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyDifficulty(item)}
                        disabled={!canAfford}
                        className={`flex items-center gap-1.5 text-[10px] font-mono font-bold py-1.5 px-4 rounded-lg transition-all active:scale-95 cursor-pointer ${
                          canAfford 
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                            : 'bg-slate-900 border border-slate-800/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3 h-3" /> {item.cost} KP
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* TAB 3: STREAK SHIELDS (FREEZES) */}
        {activeTab === 'freeze' && (
          <div className="flex flex-col lg:flex-row items-stretch gap-6">
            
            {/* Sanjeevani Lore Card */}
            <div className="bg-slate-950/60 border border-indigo-500/10 rounded-2xl p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                    <Snowflake className="w-4 h-4 animate-spin-slow" />
                  </div>
                  <h3 className="text-xs font-serif font-bold text-slate-100 uppercase tracking-widest">
                    Sanjeevani Stone (Streak Freeze)
                  </h3>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  Named after the mythical Himalayan life-restoring herb. In the consistency trials, should King Vikram falter or suffer an unavoidable absence, the <strong>Sanjeevani Stone</strong> shatters in your place, keeping your streak count absolutely intact.
                </p>

                <div className="mt-4 bg-indigo-950/15 border border-indigo-500/10 p-3 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                    <strong>AUTOMATIC TRIGGER</strong>: When you advance the system calendar via the Fast-Forward tool, if you have logged absolutely no activities, a held stone is automatically consumed. Your streak does not decay to zero!
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-900 mt-5 pt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Maximum capacity: 5 Stones</span>
                <span className="text-cyan-400">Currently Holding: {streakFreezes} / 5</span>
              </div>
            </div>

            {/* Merchant / Buy Card */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 w-full lg:w-[320px] flex flex-col justify-between text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex flex-col items-center py-4">
                <motion.div
                  animate={{ 
                    y: [0, -6, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400/20 to-indigo-500/10 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.15)] mb-4"
                >
                  <Snowflake className="w-8 h-8 text-cyan-300" />
                </motion.div>

                <h4 className="text-xs font-serif font-bold text-slate-200 uppercase tracking-widest">
                  Buy Sanjeevani Stone
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  Single-use streak protection
                </p>

                <div className="mt-4 flex items-baseline gap-1 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
                  <span className="text-xl font-bold font-mono text-slate-200">150</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Karma Points</span>
                </div>
              </div>

              <button
                onClick={handleBuyFreeze}
                disabled={karma < 150 || streakFreezes >= 5}
                className={`w-full font-serif font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                  karma >= 150 && streakFreezes < 5
                    ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border border-slate-800/80 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Snowflake className="w-4 h-4" />
                <span>Purchase Stone</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
