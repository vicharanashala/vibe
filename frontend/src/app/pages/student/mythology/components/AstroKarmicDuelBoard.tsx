import React, { useState, useEffect, useRef } from 'react';
import { Swords, Shield, Share2, Copy, Check, Sparkles, Flame, Trophy, Scroll, UserPlus, RefreshCw, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserStreakState } from '../types';
import * as THREE from 'three';

interface AstroKarmicDuelBoardProps {
  state: UserStreakState;
  triggerNotification: (message: string, type: 'success' | 'info' | 'badge') => void;
  onAdvanceDay?: () => void;
  onOpenLessons?: () => void;
}

export function AstroKarmicDuelBoard({
  state,
  triggerNotification,
  onAdvanceDay,
  onOpenLessons
}: AstroKarmicDuelBoardProps) {
  // Query Parameters State for Active Duel
  const [hasActiveDuel, setHasActiveDuel] = useState(false);
  const [challengerName, setChallengerName] = useState('');
  const [challengerStreak, setChallengerStreak] = useState(0);
  const [challengerKarma, setChallengerKarma] = useState(0);
  const [challengerAvatar, setChallengerAvatar] = useState('🔮');

  // Peer Challenge Scroll Creator State
  const [showForger, setShowForger] = useState(false);
  const [myAlias, setMyAlias] = useState(() => {
    // Pre-fill from current user profile stored in localStorage
    const currentUser = localStorage.getItem('vibe_current_profile') || '';
    return currentUser;
  });
  const [myAvatar, setMyAvatar] = useState(state.avatar || '👑');
  const [copiedLink, setCopiedLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Live peers from the app's registered local profiles
  const [localPeers, setLocalPeers] = useState<{ name: string; streak: number; karma: number; avatar: string }[]>([]);

  // Load peers from local storage and leaderboard API on mount
  useEffect(() => {
    const currentUser = localStorage.getItem('vibe_current_profile') || '';
    const peers: { name: string; streak: number; karma: number; avatar: string }[] = [];
    try {
      const stored = localStorage.getItem('vibe_profiles');
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [name, pState] of Object.entries<any>(parsed)) {
          if (name.toLowerCase() !== currentUser.toLowerCase()) {
            peers.push({
              name,
              streak: Math.max(pState.currentStreak || 0, pState.longestStreak || 0),
              karma: pState.karmaPoints || 0,
              avatar: pState.avatar || '🎓'
            });
          }
        }
      }
    } catch (e) {}

    // Also fetch from global leaderboard API
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const apiPeers = data
            .filter(p => p.name?.toLowerCase() !== currentUser.toLowerCase())
            .map(p => ({ name: p.name, streak: p.streak || 0, karma: p.karma || 0, avatar: p.avatarSeed || '🎓' }));
          // Merge, local profiles take priority
          const localNames = peers.map(p => p.name.toLowerCase());
          const merged = [...peers, ...apiPeers.filter(p => !localNames.includes(p.name.toLowerCase()))];
          setLocalPeers(merged);
        } else {
          setLocalPeers(peers);
        }
      })
      .catch(() => setLocalPeers(peers));
  }, []);

  // Parse URL Query Params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challengeParam = params.get('challenge');
    const challengerParam = params.get('challenger');
    const streakParam = params.get('streak');
    const karmaParam = params.get('karma');
    const avatarParam = params.get('avatar');

    if (challengeParam === 'true' && challengerParam) {
      setHasActiveDuel(true);
      setChallengerName(decodeURIComponent(challengerParam));
      if (streakParam) setChallengerStreak(parseInt(streakParam, 10) || 0);
      if (karmaParam) setChallengerKarma(parseInt(karmaParam, 10) || 0);
      if (avatarParam) setChallengerAvatar(decodeURIComponent(avatarParam));
      
      // Notify player of incoming challenge
      triggerNotification(`⚔️ Incoming Challenge Scroll from ${decodeURIComponent(challengerParam)}!`, 'badge');
    }
  }, []);

  // Generate shareable link
  const handleForgeLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAlias = myAlias.trim() || 'Discipline Seeker';
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?challenge=true&challenger=${encodeURIComponent(cleanAlias)}&streak=${state.currentStreak}&karma=${state.karmaPoints}&avatar=${encodeURIComponent(myAvatar)}`;
    
    setCopiedLink(shareUrl);
    
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        triggerNotification('📜 Challenge Scroll forged & copied to clipboard!', 'success');
        setTimeout(() => setIsCopied(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy link automatically', err);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 5000);
      });
  };

  // Clear query params to "End Duel"
  const handleClearDuel = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    window.history.pushState({}, '', baseUrl);
    setHasActiveDuel(false);
    triggerNotification('🛡️ Duel board cleared. Returned to solitary practice.', 'info');
  };

  // Comparative metrics
  const streakDiff = state.currentStreak - challengerStreak;
  const karmaDiff = state.karmaPoints - challengerKarma;

  // Betaal's judgment message and taunts
  let betaalJudgment = '';
  let betaalStatusColor = 'text-amber-400';
  
  if (streakDiff > 0) {
    betaalJudgment = `Betaal laughs from the sky: "Ah, Vikram! Thy steps are swift! You lead this duel by ${streakDiff} days. The challenger's resolve shakes before thy sovereign habit. Maintain thy consecutive deeds to keep the lead!"`;
    betaalStatusColor = 'text-emerald-400';
  } else if (streakDiff < 0) {
    betaalJudgment = `Betaal cackles from the branches: "Hahaha! Vikram, you trail by ${Math.abs(streakDiff)} days of resolve! The challenger's fire burns brighter. Complete thy daily lessons to vanquish their claim!"`;
    betaalStatusColor = 'text-rose-400';
  } else {
    betaalJudgment = `Betaal whispers: "Perfect equilibrium! Both duelists stand equal at ${state.currentStreak} days of unbroken vow. The next sunrise shall crown the true master!"`;
    betaalStatusColor = 'text-indigo-400';
  }

  return (
    <div id="peer-duel-container" className="mb-8">
      {/* 1. ACTIVE DUEL PANEL (Displays only when URL challenge is active) */}
      <AnimatePresence>
        {hasActiveDuel && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border-2 border-amber-500/40 rounded-3xl p-6 shadow-[0_0_35px_-5px_rgba(245,158,11,0.25)] overflow-hidden"
          >
            {/* Ancient Runes & Glowing Background Accents */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500" />
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Duel Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-amber-500 animate-pulse">
                  <Swords className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-cinzel-deco font-bold text-slate-100 tracking-wide flex items-center gap-2">
                    Astro-Karmic Duel Board
                  </h2>
                  <p className="text-xs text-slate-400 font-space">
                    Quest for the Unbroken Streak Crown
                  </p>
                </div>
              </div>

              {/* Inline 3D Consensus Node indicator */}
              <div className="flex items-center gap-2 bg-indigo-950/30 p-1.5 rounded-2xl border border-indigo-500/10">
                <KarmicConsensusNode3D />
                <div className="hidden sm:block text-left font-space leading-tight">
                  <span className="text-[8px] uppercase tracking-widest text-emerald-400 block font-bold animate-pulse">Consensus Active</span>
                  <span className="text-[9px] text-slate-500 block">KP Block Ledger</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMyAlias('Sovereign Defender');
                    setShowForger(true);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Counter Challenge
                </button>
                <button
                  onClick={handleClearDuel}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-mono transition-all"
                >
                  Exit Duel
                </button>
              </div>
            </div>

            {/* Duelists Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-6 mb-6">
              
              {/* CHALLENGER CARD (Left) */}
              <div className="md:col-span-5 bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-amber-500/25 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/35 transition-all duration-300">
                <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/10 border-l border-b border-amber-500/20 rounded-bl-xl text-[9px] font-space uppercase text-amber-500 tracking-widest font-bold">
                  Challenger
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                    {challengerAvatar}
                  </div>
                  <div>
                    <h3 className="text-base font-cinzel-deco font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                      {challengerName}
                    </h3>
                    <p className="text-xs text-amber-500/80 font-space font-bold">
                      ⚔️ Siddha Code-Sovereign
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900 font-space">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Active Streak</span>
                    <p className="text-xl font-bold text-amber-400 mt-1 flex items-baseline gap-1">
                      {challengerStreak} <span className="text-xs text-slate-400">Days</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Karmic Balance</span>
                    <p className="text-xl font-bold text-slate-200 mt-1 flex items-baseline gap-1">
                      {challengerKarma} <span className="text-xs text-slate-400">KP</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* VS DECORATION (Center) */}
              <div className="md:col-span-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-slate-950 font-cinzel-deco font-bold text-lg shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse border-2 border-slate-950 z-10">
                  VS
                </div>
                <div className="hidden md:block h-24 w-[1px] bg-gradient-to-b from-transparent via-slate-800 to-transparent -mt-6" />
              </div>

              {/* DEFENDER CARD (Right) */}
              <div className="md:col-span-5 bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/25 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/35 transition-all duration-300">
                <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500/10 border-l border-b border-indigo-500/20 rounded-bl-xl text-[9px] font-space uppercase text-indigo-400 tracking-widest font-bold">
                  You (Defender)
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                    {state.avatar || '👑'}
                  </div>
                  <div>
                    <h3 className="text-base font-cinzel-deco font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                      {localStorage.getItem('vibe_current_profile') || 'Seeker'}
                    </h3>
                    <p className="text-xs text-indigo-400 font-space font-bold">
                      🔮 Discipline Guardian
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900 font-mono">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Active Streak</span>
                    <p className="text-xl font-bold text-indigo-400 mt-1 flex items-baseline gap-1">
                      {state.currentStreak} <span className="text-xs text-slate-400">Days</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Karmic Balance</span>
                    <p className="text-xl font-bold text-slate-200 mt-1 flex items-baseline gap-1">
                      {state.karmaPoints} <span className="text-xs text-slate-400">KP</span>
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Comparative Status Banner */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest font-bold block mb-1">
                  Betaal's Judgment
                </span>
                <p className={`text-xs md:text-sm italic font-serif leading-relaxed ${betaalStatusColor}`}>
                  {betaalJudgment}
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                <div className="text-center px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[8px] text-slate-500 block">STREAK DIFF</span>
                  <span className={`font-bold ${streakDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {streakDiff >= 0 ? `+${streakDiff}` : streakDiff} Days
                  </span>
                </div>
                <div className="text-center px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[8px] text-slate-500 block">KARMA DIFF</span>
                  <span className={`font-bold ${karmaDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {karmaDiff >= 0 ? `+${karmaDiff}` : karmaDiff} KP
                  </span>
                </div>
              </div>
            </div>

            {/* Action Guidance */}
            <div className="mt-4 pt-4 border-t border-slate-900 flex flex-wrap justify-between items-center gap-4 text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Dueling quests strengthen thy resolve.
              </span>
              <div className="flex gap-3">
                {onOpenLessons && (
                  <button 
                    onClick={onOpenLessons}
                    className="text-amber-500 hover:text-amber-400 underline font-bold"
                  >
                    Resolve Academic Scrolls
                  </button>
                )}
                {onAdvanceDay && (
                  <button 
                    onClick={onAdvanceDay}
                    className="text-indigo-400 hover:text-indigo-300 underline font-bold"
                  >
                    Advance Simulated Cycle
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CHALLENGE A PEER FORGER TRIGGER */}
      {!hasActiveDuel && (
        <div className="bg-gradient-to-br from-indigo-950/20 via-slate-900/45 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
              <Scroll className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-slate-200">
                Forge a Peer Challenge Scroll
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                Pit your consecutive learning streak and karma points against a fellow seeker! Generate an ancient invite scroll to test their resolve in a friendly mythology-themed duel.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForger(!showForger)}
            className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-lg hover:shadow-amber-500/10 flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Challenge a Peer
          </button>
        </div>
      )}

      {/* 3. PEER CHALLENGE LINK CREATION PANEL (Collapsible form) */}
      <AnimatePresence>
        {showForger && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4"
          >
            <div className="bg-slate-950/95 border border-amber-500/20 rounded-2xl p-5 shadow-inner">
              <h4 className="text-xs font-serif font-bold text-amber-400 tracking-wider uppercase mb-4 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" />
                Configure Thy Challenger Scroll
              </h4>

              {/* Quick Peer Challenge: Registered Students */}
              {localPeers.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-3 h-3" /> Registered Peers on This Device
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {localPeers.slice(0, 8).map(peer => (
                      <button
                        key={peer.name}
                        type="button"
                        onClick={() => {
                          const baseUrl = window.location.origin + window.location.pathname;
                          const shareUrl = `${baseUrl}?challenge=true&challenger=${encodeURIComponent(myAlias || peer.name)}&streak=${state.currentStreak}&karma=${state.karmaPoints}&avatar=${encodeURIComponent(myAvatar)}`;
                          setCopiedLink(shareUrl);
                          navigator.clipboard.writeText(shareUrl).catch(() => {});
                          setIsCopied(true);
                          triggerNotification(`📜 Challenge scroll forged for ${peer.name}! Share the link.`, 'success');
                          setTimeout(() => setIsCopied(false), 3000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-amber-500/20 hover:border-amber-400/40 rounded-xl text-xs font-mono text-slate-300 hover:text-amber-300 transition-all"
                      >
                        <span className="text-base">{peer.avatar}</span>
                        <span>{peer.name}</span>
                        <span className="text-amber-500 font-bold text-[9px]">🔥{peer.streak}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleForgeLink} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Alias */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1.5">
                      Your Mythological Alias
                    </label>
                    <input
                      type="text"
                      value={myAlias}
                      onChange={(e) => setMyAlias(e.target.value)}
                      placeholder="e.g. Sage Dev, King Vikram"
                      className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 rounded-xl px-4 py-2 text-xs text-slate-200 font-mono transition-all outline-none"
                    />
                  </div>

                  {/* Avatar Picker */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1.5">
                      Choose Your Seal (Avatar)
                    </label>
                    <select
                      value={myAvatar}
                      onChange={(e) => setMyAvatar(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500/50 rounded-xl px-4 py-2 text-xs text-slate-200 font-mono transition-all outline-none"
                    >
                      <option value="👑">👑 Sovereign Crown</option>
                      <option value="🔮">🔮 Mystical Crystal</option>
                      <option value="⚔️">⚔️ Crossed Swords</option>
                      <option value="🛡️">🛡️ Royal Aegis</option>
                      <option value="🦉">🦉 Sacred Owl</option>
                      <option value="🦁">🦁 Guardian Lion</option>
                      <option value="🔥">🔥 Burning Fire</option>
                      <option value="📜">📜 Ancient Scroll</option>
                    </select>
                  </div>

                  {/* Stats Summary Display */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">
                      Your Current Sealed Stats
                    </span>
                    <p className="text-xs font-mono text-slate-300 mt-1 font-semibold flex items-center gap-3">
                      <span>Streak: <strong className="text-amber-500">{state.currentStreak} days</strong></span>
                      <span>Balance: <strong className="text-indigo-400">{state.karmaPoints} KP</strong></span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    Forge and Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForger(false)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-mono transition-all"
                  >
                    Collapse
                  </button>
                </div>
              </form>

              {/* Share URL input field fallback / feedback */}
              {copiedLink && (
                <div className="mt-4 pt-4 border-t border-slate-900/60 font-mono">
                  <label className="block text-[8px] uppercase tracking-widest text-slate-500 mb-1">
                    Your Forged Challenge Scroll Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={copiedLink}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-indigo-400 font-mono outline-none cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(copiedLink);
                        setIsCopied(true);
                        triggerNotification('📜 Challenge Scroll Link copied!', 'success');
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="p-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/20 text-indigo-400 rounded-xl transition-all"
                      title="Copy Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-500/80 mt-1.5 italic">
                    Send this legendary link to your friend! Once opened, it will pit your streak directly against theirs in their royal interface.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function KarmicConsensusNode3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = 48;
    const height = 48;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1.5, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // amber glow
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const coreGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x10b981 // emerald node core
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      const speed = hovered ? 4.0 : 1.2;
      mesh.rotation.x = time * 0.4 * speed;
      mesh.rotation.y = time * 0.7 * speed;

      const scale = 1.0 + Math.sin(time * 6.0) * 0.3;
      core.scale.set(scale, scale, scale);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [hovered]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-12 h-12 bg-slate-900 border border-emerald-500/20 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden group shadow-md"
      title="Interactive Web3 Consensus Block Node"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}
