import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Moon, Compass, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';

// 3D Ethereal Moon Shield that shifts to a golden sun when secured
function MoonShield3D({ isSecured }: { isSecured: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = 80;
    const height = 80;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 4.0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Color: deep indigo/sky-blue or radiant gold
    const colorHex = isSecured ? 0xeab308 : 0x818cf8;

    const geometry = new THREE.SphereGeometry(0.8, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    const moon = new THREE.Mesh(geometry, material);
    scene.add(moon);

    // Ethereal saturn-like orbit ring around the lunar shield
    const ringGeo = new THREE.RingGeometry(1.1, 1.25, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Gentle rotation
      moon.rotation.y = time * 0.5;
      ring.rotation.z = -time * 0.2;

      // Pulse based on status
      const pulseSpeed = isSecured ? 1.5 : 4.0;
      const scaleVal = 1.0 + Math.sin(time * pulseSpeed) * 0.08;
      moon.scale.set(scaleVal, scaleVal, scaleVal);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isSecured]);

  return (
    <div ref={mountRef} className="w-20 h-20 bg-slate-950/60 border border-indigo-500/10 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden shadow-inner" />
  );
}

interface AccountabilityNudgeProps {
  currentStreak: number;
  isTodayLogged: boolean;
  onLogQuickActivity: () => void;
}

export const AccountabilityNudge: React.FC<AccountabilityNudgeProps> = ({
  currentStreak,
  isTodayLogged,
  onLogQuickActivity
}) => {
  const [showNudge, setShowNudge] = useState(false);

  // Play a synthesized magical chime using the browser's Web Audio API
  const playChime = () => {
    try {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const now = ctx.currentTime;
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play minor-pentatonic magical sequence
      playTone(523.25, now, 1.2);       // C5
      playTone(587.33, now + 0.15, 1.0);  // D5
      playTone(659.25, now + 0.3, 0.8);   // E5
      playTone(783.99, now + 0.45, 1.5);  // G5
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by user gesture:', e);
    }
  };

  const triggerNudge = () => {
    setShowNudge(true);
    playChime();
  };

  return (
    <div id="accountability-nudge-section" className="flex flex-col gap-4">
      {/* Background/Ambient Alert Widget always visible in sidebar/panel */}
      <div className={`p-6 rounded-3xl border flex items-center gap-4 transition-all duration-300 ${
        isTodayLogged
          ? 'bg-gradient-to-br from-emerald-950/20 to-slate-950/90 border-emerald-500/25 text-emerald-300'
          : 'bg-gradient-to-br from-indigo-950/20 to-slate-950/90 border-indigo-500/25 text-indigo-300'
      }`}>
        <div className="flex-shrink-0">
          <MoonShield3D isSecured={isTodayLogged} />
        </div>
        <div className="flex-1">
          <h4 className="text-xs sm:text-sm font-bold font-space uppercase tracking-widest text-slate-100 flex items-center gap-1.5">
            {isTodayLogged ? (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" /> Presence Confirmed
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" /> Vow Safeguard (10:30 PM Guard)
              </>
            )}
          </h4>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-space">
            {isTodayLogged
              ? 'Excellent. You have logged your daily presence. The learning vow is preserved, and the streak is safe.'
              : 'The moon is rising. You have not logged any activity. Betaal is waiting at the ancient tree at 10:30 PM.'}
          </p>
          {!isTodayLogged && (
            <div className="flex gap-2.5 mt-3">
              <button
                onClick={triggerNudge}
                id="btn-simulate-nudge"
                className="bg-slate-950 hover:bg-slate-900 text-indigo-300 hover:text-indigo-200 text-[10px] font-space font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 border border-slate-900 hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Simulate 10:30 PM Nudge
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Popover overlay modal for the actual Betaal Smart Nudge */}
      <AnimatePresence>
        {showNudge && !isTodayLogged && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              id="betaal-nudge-modal"
              className="bg-slate-950 border border-indigo-500/25 rounded-3xl w-full max-w-lg p-7 shadow-2xl relative overflow-hidden text-center"
            >
              {/* Ghostly smoke aura background effect */}
              <div className="absolute inset-x-0 -top-12 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
              
              <div className="flex justify-center mb-4">
                <MoonShield3D isSecured={false} />
              </div>

              <span className="text-[10px] font-mono tracking-widest text-indigo-400 uppercase font-bold block mb-1">
                Ambient Vow Alert
              </span>
              <h3 className="text-lg font-uncial font-bold text-slate-100 mb-2 tracking-wide">
                "The day is not yet over, Seeker."
              </h3>
              
              {/* Betaal's Dialogue Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 my-4 relative">
                <p className="text-xs sm:text-sm italic text-slate-300 leading-relaxed font-space">
                  "Halt, Seeker. The night grows cold. Will you allow your hard-earned <span className="text-indigo-300 font-bold font-mono">{currentStreak} day streak</span> to dissolve into the shadows? Or will you maintain Vikram's walk?"
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500">
                  <span>Your streak resets to 0 in 1.5 hours</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    onLogQuickActivity();
                    setShowNudge(false);
                  }}
                  id="btn-nudge-quick-solve"
                  className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-indigo-500 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer font-space"
                >
                  <Compass className="w-4 h-4 text-indigo-400" /> Answer Betaal: Complete Spaced Revision
                </button>

                <button
                  onClick={() => setShowNudge(false)}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 py-2.5 px-4 rounded-xl text-xs transition-all font-space"
                >
                  Postpone decision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
