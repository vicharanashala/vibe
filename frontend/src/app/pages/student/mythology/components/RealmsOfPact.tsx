import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Compass, Sparkles, Award, Eye, Scroll, Shield, Clock, Users, Zap } from 'lucide-react';
import * as THREE from 'three';

// 3D Sacred Geometric Aligner Node that changes color live based on the selected/attuned grove
function RealmAligner3D({ attunedId }: { attunedId: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = 64;
    const height = 64;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Map the current attuned ID to its specific color hex
    let targetColor = 0xd4af37; // Default gold
    if (attunedId === 'ujjain') targetColor = 0x10b981; // emerald
    else if (attunedId === 'preta') targetColor = 0x14b8a6; // teal
    else if (attunedId === 'siddha') targetColor = 0xf59e0b; // amber
    else if (attunedId === 'karma') targetColor = 0xf43f5e; // rose

    // Sacred octahedron representation
    const geometry = new THREE.OctahedronGeometry(1.2, 0);
    const material = new THREE.MeshBasicMaterial({
      color: targetColor,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Mini glowing center core
    const coreGeo = new THREE.SphereGeometry(0.4, 10, 10);
    const coreMat = new THREE.MeshBasicMaterial({
      color: targetColor,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Faster rotation when attuned
      const speed = attunedId ? 2.5 : 0.8;
      mesh.rotation.y = time * 0.5 * speed;
      mesh.rotation.z = time * 0.3 * speed;

      // Pulse core scale
      const scaleVal = 1.0 + Math.sin(time * 6.0) * 0.25;
      core.scale.set(scaleVal, scaleVal, scaleVal);

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
  }, [attunedId]);

  return (
    <div
      ref={containerRef}
      className="w-16 h-16 bg-slate-950/60 border border-slate-900 rounded-full flex items-center justify-center relative overflow-hidden"
      title="Dynamic Attunement Rune Aligner"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-teal-500/5 pointer-events-none" />
    </div>
  );
}

interface Realm {
  id: 'ujjain' | 'preta' | 'siddha' | 'karma';
  name: string;
  slogan: string;
  description: string;
  lore: string;
  colors: {
    primary: string;
    border: string;
    glow: string;
    text: string;
    bg: string;
  };
  icon: React.ComponentType<any>;
  element: string;
  focusElementId: string;
  treeType: 'ashoka' | 'banyan' | 'cedar' | 'kadamba';
}

const REALMS: Realm[] = [
  {
    id: 'ujjain',
    name: "Ujjain's Ashoka Grove",
    slogan: "Unwavering Grounded Willpower",
    description: "Governs streak preservation, daily vows, and deep steel-wood trunk grounding.",
    lore: "King Vikram's ancestral stronghold set within an unbreakable Ashoka Tree forest. The deep, grounding root system shields your active streak from decaying, anchoring your mental discipline like iron-bark.",
    colors: {
      primary: 'text-emerald-500',
      border: 'border-emerald-500/30 hover:border-emerald-500/70',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]',
      text: 'text-emerald-400',
      bg: 'from-emerald-950/20 to-slate-950'
    },
    icon: Shield,
    element: "Sacred Ashoka Tree",
    focusElementId: "btn-action-watch-video",
    treeType: 'ashoka'
  },
  {
    id: 'preta',
    name: "Preta Spectral Banyan Canopy",
    slogan: "Active Recall among Hanging Vines",
    description: "Governs spaced repetition, mind puzzles, and cognitive recall.",
    lore: "Betaal's dark, ancestral Banyan grove in the deep cemetery. Hanging roots hold active memory nodes; each rustled branch triggers active recall challenges and spectral riddles.",
    colors: {
      primary: 'text-teal-500',
      border: 'border-teal-500/30 hover:border-teal-500/70',
      glow: 'shadow-[0_0_20px_rgba(20,184,166,0.15)] hover:shadow-[0_0_30px_rgba(20,184,166,0.35)]',
      text: 'text-teal-400',
      bg: 'from-teal-950/20 to-slate-950'
    },
    icon: Flame,
    element: "Whispering Banyan",
    focusElementId: "betaal-riddles-panel-root",
    treeType: 'banyan'
  },
  {
    id: 'siddha',
    name: "Siddha Sacred Deodar Rings",
    slogan: "Temporal Secrets of Chrono-Trees",
    description: "Governs time-travel, historical audits, and chronological warp rings.",
    lore: "High-altitude cedar forests where the sages trace time-travel by examining concentric rings of ancient Deodar trees, letting you mend decayed branches in the past.",
    colors: {
      primary: 'text-amber-500',
      border: 'border-amber-500/30 hover:border-amber-500/70',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]',
      text: 'text-amber-400',
      bg: 'from-amber-950/20 to-slate-950'
    },
    icon: Clock,
    element: "Golden Deodar",
    focusElementId: "time-travel-panel-root",
    treeType: 'cedar'
  },
  {
    id: 'karma',
    name: "Kadamba Blossoms Guild",
    slogan: "Synergy of the Shared Canopy",
    description: "Governs peer logs, accountability nudges, and collaborative karma.",
    lore: "The sprawling, sunlit Kadamba groves. Blossoms fall onto the collective woodland floor, validating peer streaks and converting individual efforts into common ecological life.",
    colors: {
      primary: 'text-rose-500',
      border: 'border-rose-500/30 hover:border-rose-500/70',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:shadow-[0_0_30px_rgba(244,63,94,0.35)]',
      text: 'text-rose-400',
      bg: 'from-rose-950/20 to-slate-950'
    },
    icon: Scroll,
    element: "Flowering Kadamba",
    focusElementId: "synergy-panel-root",
    treeType: 'kadamba'
  }
];

interface RealmsOfPactProps {
  onNotify: (message: string, type: 'success' | 'info' | 'badge') => void;
  onAttuneRealm: (realmId: string) => void;
  soundEnabled?: boolean;
}

export const RealmsOfPact: React.FC<RealmsOfPactProps> = ({ onNotify, onAttuneRealm, soundEnabled = true }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [attunedId, setAttunedId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hoverSoundPlayedRef = useRef<Record<string, boolean>>({});

  // Synth magical chord for realm attunement
  const playRealmSound = (id: string) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Map each realm to a unique chord representing its element
      let frequencies = [220.0, 277.18, 329.63, 440.0]; // Ujjain (A major resolution)
      if (id === 'preta') {
        frequencies = [196.0, 233.08, 293.66, 392.00]; // Preta (G minor mysterious)
      } else if (id === 'siddha') {
        frequencies = [164.81, 220.0, 261.63, 329.63]; // Siddha (E minor ancient)
      } else if (id === 'karma') {
        frequencies = [261.63, 329.63, 392.00, 523.25]; // Karma (C major crystalline)
      }

      // Create polyphonic sound synthesis
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = id === 'preta' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // Gentle swell
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.15 + (idx * 0.05));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2 + (idx * 0.1));

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      });
    } catch (e) {
      console.warn('Audio synthesis skipped:', e);
    }
  };

  // Play delicate rustling forest wood chime when hovering a card
  const playHoverChime = (id: string) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // High whimsical forest scale frequencies
      const freqs = { ujjain: 587.33, preta: 659.25, siddha: 783.99, karma: 880.00 };
      osc.frequency.setValueAtTime(freqs[id as keyof typeof freqs] || 600, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Ignore audio error
    }
  };

  const handleAttune = (realm: Realm) => {
    setAttunedId(realm.id);
    playRealmSound(realm.id);
    onAttuneRealm(realm.id);

    // Notify user
    onNotify(`🌳 Attuned to the ${realm.name}! The ancient trees hum in alignment...`, 'success');

    // Smoothly scroll and highlight the target element
    setTimeout(() => {
      const el = document.getElementById(realm.focusElementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash glow border effect on target
        el.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2', 'ring-offset-slate-950', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2', 'ring-offset-slate-950');
        }, 2500);
      }
    }, 450);
  };

  return (
    <div className="w-full" id="realms-of-pact-root">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-950/40 p-4 rounded-3xl border border-slate-900">
        <div className="flex items-center gap-4">
          {/* Interactive 3D Aligner Badge right in the header */}
          <RealmAligner3D attunedId={attunedId} />
          <div>
            <h2 className="text-base sm:text-lg font-uncial font-bold text-slate-100 tracking-wider uppercase flex items-center gap-2">
              🌲 Realms of the Whispering Forest
            </h2>
            <p className="text-xs text-slate-400 font-fondamento mt-0.5">
              Attune your spirit to a specific sacred grove to guide your focus & trace deep historical learnings.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-xl text-[10px] font-mono text-emerald-400">
          <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Forest Whisper-Chimes Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {REALMS.map((realm) => {
          const Icon = realm.icon;
          const isHovered = hoveredId === realm.id;
          const isAttuned = attunedId === realm.id;

          return (
            <motion.div
              key={realm.id}
              whileHover={{ y: -6, scale: 1.015 }}
              onHoverStart={() => {
                setHoveredId(realm.id);
                playHoverChime(realm.id);
              }}
              onHoverEnd={() => setHoveredId(null)}
              onClick={() => handleAttune(realm)}
              id={`realm-card-${realm.id}`}
              className={`group relative bg-gradient-to-b ${realm.colors.bg} rounded-2xl p-5 border cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                isAttuned 
                  ? 'border-amber-500/80 ring-1 ring-amber-500/20 ' + realm.colors.glow
                  : isHovered 
                  ? realm.colors.border + ' ' + realm.colors.glow
                  : 'border-slate-900 shadow-xl'
              }`}
            >
              {/* Gold etched metallic accent frame corners */}
              <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-amber-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-amber-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-amber-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-amber-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Tree Silhouette Background with subtle hover reactions */}
              <div className="absolute right-3 top-14 opacity-15 group-hover:opacity-40 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 pointer-events-none select-none z-0">
                {realm.treeType === 'ashoka' && (
                  <svg className="w-20 h-20 text-emerald-500" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M50 5 L20 45 L38 45 L15 75 L45 75 L5 90 L95 90 L55 75 L85 75 L62 45 L80 45 Z" />
                    <rect x="46" y="90" width="8" height="10" fill="#78350f" />
                  </svg>
                )}
                {realm.treeType === 'banyan' && (
                  <svg className="w-20 h-20 text-teal-500" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M50 15 C20 15 10 40 10 55 C10 65 25 65 32 65 C38 60 42 80 42 90 L58 90 C58 80 62 60 68 65 C75 65 90 65 90 55 C90 40 80 15 50 15 Z" />
                    <line x1="20" y1="55" x2="20" y2="85" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3,3" />
                    <line x1="80" y1="55" x2="80" y2="85" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3,3" />
                    <line x1="50" y1="50" x2="50" y2="90" stroke="#78350f" strokeWidth="5" />
                  </svg>
                )}
                {realm.treeType === 'cedar' && (
                  <svg className="w-20 h-20 text-amber-500" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M50 5 L30 35 L70 35 Z M50 20 L18 55 L82 55 Z M50 40 L5 82 L95 82 Z" />
                    <circle cx="50" cy="90" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
                    <circle cx="50" cy="90" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="47" y="82" width="6" height="8" fill="#78350f" />
                  </svg>
                )}
                {realm.treeType === 'kadamba' && (
                  <svg className="w-20 h-20 text-rose-500" viewBox="0 0 100 100" fill="currentColor">
                    <circle cx="50" cy="40" r="32" />
                    <circle cx="32" cy="30" r="4.5" fill="#fbcfe8" />
                    <circle cx="68" cy="30" r="4.5" fill="#fbcfe8" />
                    <circle cx="50" cy="18" r="4.5" fill="#fbcfe8" />
                    <circle cx="40" cy="52" r="4.5" fill="#fbcfe8" />
                    <circle cx="60" cy="52" r="4.5" fill="#fbcfe8" />
                    <circle cx="50" cy="40" r="5" fill="#fbcfe8" />
                    <rect x="46" y="72" width="8" height="20" fill="#78350f" />
                  </svg>
                )}
              </div>

              {/* Fluttering Forest Leaves Particle Spray when active */}
              {isHovered && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl select-none z-10">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ y: -10, x: Math.random() * 80 + 10, opacity: 0, rotate: 0 }}
                      animate={{ 
                        y: 160, 
                        x: `calc(${Math.random() * 80 + 10}% + ${Math.sin(i) * 20}px)`, 
                        opacity: [0, 0.8, 0.8, 0],
                        rotate: 360 
                      }}
                      transition={{ 
                        duration: 1.8 + Math.random() * 1.2, 
                        repeat: Infinity,
                        delay: i * 0.4
                      }}
                      className="absolute text-emerald-400 text-xs"
                    >
                      {i % 2 === 0 ? '🍃' : '🍂'}
                    </motion.span>
                  ))}
                </div>
              )}

              {/* Glowing background starfield overlay when hovered */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,transparent_60%,rgba(212,175,55,0.02))] pointer-events-none rounded-2xl z-0" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl bg-slate-950 border border-slate-900 transition-colors ${
                    isHovered ? 'text-amber-400 border-amber-500/30' : 'text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400/80 uppercase bg-slate-950/60 border border-emerald-900/30 px-2 py-0.5 rounded">
                    {realm.element}
                  </span>
                </div>

                <span className="text-[10px] font-space font-bold tracking-widest uppercase block text-amber-500 mb-1 leading-none">
                  {realm.slogan}
                </span>

                <h3 className="text-xs font-cinzel-deco font-bold text-slate-100 group-hover:text-amber-400 transition-colors tracking-wide leading-tight mb-2">
                  {realm.name}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed font-fondamento mb-3 min-h-[48px]">
                  {realm.description}
                </p>
              </div>

              {/* Lore Expansion with animated presence */}
              <div className="border-t border-slate-900/80 pt-3 mt-2 relative z-10">
                <p className="text-[11px] font-mono text-slate-500 italic leading-relaxed">
                  "{realm.lore.substring(0, 95)}..."
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-indigo-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Align Spirit Portal →
                  </span>
                  {isAttuned && (
                    <span className="text-[9px] font-mono text-amber-500 font-bold animate-pulse">
                      ● Attuned
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
