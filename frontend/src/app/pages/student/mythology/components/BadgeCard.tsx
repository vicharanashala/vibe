import React from 'react';
import { Badge } from '../types';
import { Sparkles, Lock, CheckCircle2, Share2, Info } from 'lucide-react';
import { motion } from 'motion/react';

// Highly detailed custom SVG icons for each mythological badge
export const BadgeSVG: React.FC<{ id: string; className?: string; unlocked: boolean }> = ({ id, className = "w-16 h-16", unlocked }) => {
  const grayscaleFilter = unlocked ? "" : "filter grayscale opacity-40";

  switch (id) {
    case 'spark': // Seeker's Spark - 3 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="spark-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff9a00" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ff4d00" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="spark-flame" x1="0%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#ff4d00" />
              <stop offset="50%" stopColor="#ff9f1c" />
              <stop offset="100%" stopColor="#ffe49e" />
            </linearGradient>
          </defs>
          {unlocked && <circle cx="60" cy="60" r="50" fill="url(#spark-glow)" />}
          {/* Flame Shield Outline */}
          <circle cx="60" cy="60" r="45" stroke="#ffe49e" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
          {/* Flame Shapes */}
          <path d="M60 20C75 45 90 60 75 85C60 100 40 95 35 80C30 65 45 45 60 20Z" fill="url(#spark-flame)" />
          <path d="M60 40C68 55 78 65 70 80C62 90 50 88 47 80C44 72 52 60 60 40Z" fill="#ffe49e" opacity="0.8" />
          <circle cx="60" cy="75" r="6" fill="#fff" />
          {/* Floating Sparkles */}
          <circle cx="35" cy="40" r="2" fill="#ffe49e" />
          <circle cx="85" cy="50" r="3" fill="#ff9f1c" />
          <circle cx="45" cy="90" r="2" fill="#ffe49e" />
          <circle cx="75" cy="30" r="1.5" fill="#fff" />
        </svg>
      );

    case 'lantern': // Seeker's Lantern - 7 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="lantern-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffe49e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="50%" stopColor="#aa7c11" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>
          </defs>
          {unlocked && <circle cx="60" cy="60" r="50" fill="url(#lantern-glow)" />}
          {/* Arch framing */}
          <path d="M30 90C30 90 25 35 60 20C95 35 90 90 90 90" stroke="url(#metal-grad)" strokeWidth="3" fill="none" />
          {/* Lantern Dome */}
          <path d="M45 40C45 35 50 30 60 30C70 30 75 35 75 40H45Z" fill="url(#metal-grad)" />
          {/* Lantern Body Glass */}
          <path d="M45 40L40 80C40 85 45 90 60 90C75 90 80 85 80 80L75 40H45Z" fill="#ffefc2" fillOpacity="0.2" stroke="url(#metal-grad)" strokeWidth="2" />
          {/* Glowing Flame inside */}
          <path d="M60 55C65 65 70 70 65 80C60 85 55 85 50 80C45 70 55 65 60 55Z" fill="#ffd000" />
          <path d="M60 62C62 68 65 71 62 76C60 79 57 79 55 76C52 71 58 68 60 62Z" fill="#fff" />
          {/* Metal cage bars */}
          <line x1="52" y1="40" x2="48" y2="90" stroke="url(#metal-grad)" strokeWidth="1.5" />
          <line x1="68" y1="40" x2="72" y2="90" stroke="url(#metal-grad)" strokeWidth="1.5" />
          <line x1="60" y1="30" x2="60" y2="15" stroke="url(#metal-grad)" strokeWidth="2" />
          {/* Base */}
          <rect x="38" y="85" width="44" height="6" rx="2" fill="url(#metal-grad)" />
        </svg>
      );

    case 'riddle': // Riddle-Keeper - 14 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="scroll-paper" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fdf6e2" />
              <stop offset="60%" stopColor="#f3e5ab" />
              <stop offset="100%" stopColor="#dfcd8c" />
            </linearGradient>
            <linearGradient id="scroll-wood" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5a2b" />
              <stop offset="100%" stopColor="#5c3815" />
            </linearGradient>
          </defs>
          {/* Scroll rollers */}
          <rect x="25" y="15" width="10" height="90" rx="3" fill="url(#scroll-wood)" />
          <rect x="85" y="15" width="10" height="90" rx="3" fill="url(#scroll-wood)" />
          {/* Scroll body */}
          <path d="M35 20H85V100H35V20Z" fill="url(#scroll-paper)" stroke="#5c3815" strokeWidth="2" />
          {/* Ancient scriptures / lines */}
          <path d="M42 35H78" stroke="#8b5a2b" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" />
          <path d="M42 45H78" stroke="#8b5a2b" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
          {/* Riddle Seal symbol in the center (Betaal's face silhouette) */}
          <circle cx="60" cy="65" r="15" fill="#b22222" opacity="0.8" />
          <path d="M55 60C55 60 57 56 60 56C63 56 65 60 65 60" stroke="#ffd700" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M53 65C57 66 63 66 67 65" stroke="#ffd700" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M56 71C58 73 62 73 64 71L60 75L56 71Z" fill="#ffd700" />
          {/* Ribbon */}
          <path d="M30 75H90" stroke="#b22222" strokeWidth="3" />
        </svg>
      );

    case 'oath': // Vetaal's Oath - 30 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="oath-fire" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#9400d3" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#4b0082" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sword-metal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e6e6fa" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#b0c4de" />
            </linearGradient>
            <linearGradient id="gold-hilt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="100%" stopColor="#b8860b" />
            </linearGradient>
          </defs>
          {unlocked && <circle cx="60" cy="60" r="50" fill="url(#oath-fire)" />}
          {/* Ritual Altar Base */}
          <path d="M30 95H90L80 80H40L30 95Z" fill="#4a4a4a" stroke="#d4af37" strokeWidth="1.5" />
          {/* Sword Blade plunged vertically */}
          <path d="M57 25L63 25L62 82L58 82L57 25Z" fill="url(#sword-metal)" stroke="#4b0082" strokeWidth="1" />
          <line x1="60" y1="25" x2="60" y2="82" stroke="#4b0082" strokeWidth="0.8" />
          {/* Crossguard */}
          <rect x="46" y="80" width="28" height="6" rx="2" fill="url(#gold-hilt)" />
          {/* Sword Grip */}
          <rect x="56" y="86" width="8" height="12" rx="1" fill="#8b0000" />
          {/* Pommel */}
          <circle cx="60" cy="100" r="4" fill="url(#gold-hilt)" />
          {/* Spectral Fire Aura */}
          <path d="M42 80C42 80 40 50 60 30C80 50 78 80 78 80" stroke="#ba55d3" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" opacity="0.6" />
          <path d="M48 75C48 75 45 55 60 40C75 55 72 75 72 75" stroke="#9370db" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
        </svg>
      );

    case 'unbroken': // The Unbroken - 60 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gold-chain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff3cc" />
              <stop offset="35%" stopColor="#ffd700" />
              <stop offset="70%" stopColor="#b8860b" />
              <stop offset="100%" stopColor="#ffd700" />
            </linearGradient>
            <radialGradient id="unbroken-ring" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#1e293b" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffd700" stopOpacity="0.4" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="46" fill="url(#unbroken-ring)" />
          {/* Outer Ring with nodes */}
          <circle cx="60" cy="60" r="44" stroke="url(#gold-chain)" strokeWidth="3" />
          {/* Intricate Interlinked Sacred Geometry / Chain Links */}
          <circle cx="60" cy="35" r="10" stroke="url(#gold-chain)" strokeWidth="2" fill="none" />
          <circle cx="60" cy="85" r="10" stroke="url(#gold-chain)" strokeWidth="2" fill="none" />
          <circle cx="35" cy="60" r="10" stroke="url(#gold-chain)" strokeWidth="2" fill="none" />
          <circle cx="85" cy="60" r="10" stroke="url(#gold-chain)" strokeWidth="2" fill="none" />
          
          <circle cx="43" cy="43" r="10" stroke="url(#gold-chain)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          <circle cx="77" cy="43" r="10" stroke="url(#gold-chain)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          <circle cx="43" cy="77" r="10" stroke="url(#gold-chain)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          <circle cx="77" cy="77" r="10" stroke="url(#gold-chain)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          
          {/* Center Jewel */}
          <polygon points="60,48 70,60 60,72 50,60" fill="#ffd700" />
          <circle cx="60" cy="60" r="4" fill="#fff" />
        </svg>
      );

    case 'resolve': // Vikram's Resolve - 100 Days
      return (
        <svg className={`${className} ${grayscaleFilter}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="royal-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#ffe875" />
              <stop offset="50%" stopColor="#f3c623" />
              <stop offset="75%" stopColor="#a77c00" />
              <stop offset="100%" stopColor="#f3c623" />
            </linearGradient>
            <radialGradient id="legend-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f3c623" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#ff4500" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>
          {unlocked && <circle cx="60" cy="60" r="55" fill="url(#legend-glow)" />}
          {/* Radiant Sunrays */}
          {unlocked && (
            <g opacity="0.6">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={deg}
                  x1="60"
                  y1="60"
                  x2={60 + 50 * Math.cos((deg * Math.PI) / 180)}
                  y2={60 + 50 * Math.sin((deg * Math.PI) / 180)}
                  stroke="url(#royal-gold)"
                  strokeWidth="1.5"
                  strokeDasharray="4 8"
                />
              ))}
            </g>
          )}
          {/* Crown Base */}
          <path d="M25 80H95L90 90H30L25 80Z" fill="url(#royal-gold)" stroke="#7a5800" strokeWidth="1.5" />
          <rect x="35" y="83" width="50" height="4" fill="#b22222" rx="1" />
          {/* Small Jewels on Base */}
          <circle cx="40" cy="85" r="1.5" fill="#fff" />
          <circle cx="50" cy="85" r="1.5" fill="#32cd32" />
          <circle cx="60" cy="85" r="1.5" fill="#fff" />
          <circle cx="70" cy="85" r="1.5" fill="#32cd32" />
          <circle cx="80" cy="85" r="1.5" fill="#fff" />
          {/* Crown Spikes */}
          <path d="M25 80L35 45L48 68L60 30L72 68L85 45L95 80H25Z" fill="url(#royal-gold)" stroke="#7a5800" strokeWidth="1.5" />
          {/* Main Jewels */}
          <circle cx="35" cy="45" r="4" fill="#b22222" stroke="url(#royal-gold)" strokeWidth="1" />
          <circle cx="60" cy="30" r="5" fill="#0000ff" stroke="url(#royal-gold)" strokeWidth="1" />
          <circle cx="85" cy="45" r="4" fill="#b22222" stroke="url(#royal-gold)" strokeWidth="1" />
          {/* Center Lotus seal symbol on the crown */}
          <path d="M60 52C57 56 55 62 60 70C65 62 63 52 60 52Z" fill="#ffefc2" opacity="0.9" />
          <path d="M60 58C53 60 50 66 60 70C70 66 67 60 60 58Z" fill="#ffefc2" opacity="0.7" />
        </svg>
      );

    default:
      return null;
  }
};

export const LIST_BADGES: Badge[] = [
  {
    id: 'spark',
    name: "Seeker's Spark",
    daysRequired: 3,
    significance: "The decision to begin.",
    lore: "King Vikram makes his first pledge to capture Betaal. Overcoming the initial barrier of starting is where true transformation begins. Reaching 3 days is the critical threshold of learner commitment.",
    colorFrom: "from-orange-500",
    colorTo: "to-amber-500"
  },
  {
    id: 'lantern',
    name: "Seeker's Lantern",
    daysRequired: 7,
    significance: "One full week.",
    lore: "Walking through the dark crematorium forest, King Vikram relies on a single lantern to guide his steps. One complete week proves you have successfully shaped an active daily learning habit.",
    colorFrom: "from-amber-400",
    colorTo: "to-yellow-600"
  },
  {
    id: 'riddle',
    name: "Riddle-Keeper",
    daysRequired: 14,
    significance: "Betaal tests with riddles.",
    lore: "Betaal begins hanging from the ancient tree, telling complex tales and demanding deep truth-seeking. Two weeks in, you have proven that you possess the patience and grit to sit with hard riddles.",
    colorFrom: "from-amber-600",
    colorTo: "to-emerald-600"
  },
  {
    id: 'oath',
    name: "Vetaal's Oath",
    daysRequired: 30,
    significance: "A month of showing up.",
    lore: "An entire month of undeterred daily persistence. Vikram makes an unconditional oath to the hermit. Betaal yields to this deep integrity, acknowledging the learner's devotion.",
    colorFrom: "from-purple-600",
    colorTo: "to-indigo-800"
  },
  {
    id: 'unbroken',
    name: "The Unbroken",
    daysRequired: 60,
    significance: "Rare. Two full months.",
    lore: "No gaps, no lapses. The golden thread of your learning habit has welded itself into your very identity. You do not just study; showing up is simply who you are.",
    colorFrom: "from-blue-600",
    colorTo: "to-cyan-500"
  },
  {
    id: 'resolve',
    name: "Vikram's Resolve",
    daysRequired: 100,
    significance: "The absolute legend.",
    lore: "The legendary 100-day crown. Vikram completes his quest despite twenty-four continuous capture attempts. Your name is etched as an absolute paragon of discipline on the ViBe platform.",
    colorFrom: "from-amber-500",
    colorTo: "to-red-600"
  }
];

interface BadgeCardProps {
  badge: Badge;
  unlocked: boolean;
  onShare: (badge: Badge) => void;
  streakCount: number;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, unlocked, onShare, streakCount }) => {
  const [showLore, setShowLore] = React.useState(false);

  const progressPercent = Math.min(100, Math.round((streakCount / badge.daysRequired) * 100));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: unlocked ? -4 : 0 }}
      id={`badge-card-${badge.id}`}
      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 ${
        unlocked
          ? 'bg-slate-950 border-indigo-500/30 shadow-[0_0_25px_-5px_rgba(99,102,241,0.15)]'
          : 'bg-slate-950/60 border-slate-900 opacity-70'
      }`}
    >
      {/* Absolute Header Ribbon for Unlocked Badges */}
      {unlocked && (
        <span className="absolute -top-2.5 -right-2 bg-slate-900 border border-indigo-500/50 text-[9px] font-mono uppercase font-bold text-indigo-300 px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
          <Sparkles className="w-3 h-3 animate-pulse text-indigo-400" /> UNLOCKED
        </span>
      )}

      <div>
        <div className="flex justify-center mb-4 relative group">
          <div className="relative">
            <BadgeSVG id={badge.id} className="w-24 h-24 relative z-10 transition-transform duration-500 group-hover:scale-105" unlocked={unlocked} />
            {unlocked && (
              <div className="absolute inset-0 bg-indigo-500/5 blur-xl rounded-full scale-125 -z-10 animate-pulse" />
            )}
          </div>
        </div>

        <div className="text-center">
          <h3 className="font-serif font-bold text-base text-slate-200 tracking-wide flex items-center justify-center gap-1">
            {badge.name}
            {!unlocked && <Lock className="w-3.5 h-3.5 text-slate-600" />}
          </h3>
          <p className="font-mono text-[10px] text-indigo-400 mt-1 uppercase tracking-widest font-semibold">
            {badge.daysRequired} Day Streak Milestone
          </p>
          <p className="text-xs text-slate-400 mt-2 line-clamp-2 min-h-[2rem] leading-relaxed italic font-sans">
            "{badge.significance}"
          </p>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-900">
        {/* Progress or Actions */}
        {!unlocked ? (
          <div>
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1">
              <span>Progress</span>
              <span>{streakCount} / {badge.daysRequired} Days</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-900">
              <div
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onShare(badge)}
              id={`share-btn-${badge.id}`}
              className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer font-mono"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Badge
            </button>
            <button
              onClick={() => setShowLore(!showLore)}
              id={`lore-btn-${badge.id}`}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 p-2 rounded-lg transition-all cursor-pointer"
              title="Read Mythological Lore"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mythology Lore Overlay Modal/Block inside card */}
      {showLore && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between z-20 shadow-2xl"
        >
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest">Ancient Legend</span>
              <button
                onClick={() => setShowLore(false)}
                className="text-slate-500 hover:text-slate-300 font-bold text-xs"
              >
                ✕
              </button>
            </div>
            <h4 className="text-slate-200 font-serif font-bold text-sm mb-1.5">{badge.name} Lore</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-h-[140px] overflow-y-auto pr-1">
              {badge.lore}
            </p>
          </div>
          <button
            onClick={() => setShowLore(false)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] py-1.5 rounded-lg transition-all font-mono"
          >
            Go Back
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};
