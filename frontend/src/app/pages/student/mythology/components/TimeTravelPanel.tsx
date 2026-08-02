import React, { useState, useEffect, useRef } from 'react';
import { Calendar, SkipForward, Flame, RotateCcw, Compass } from 'lucide-react';
import * as THREE from 'three';

// Real-time interactive 3D Chrono-Astrolabe Globe
function ChronoGlobe3D({ speedMultiplier }: { speedMultiplier: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = 110;
    const height = 110;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Astro-sphere (Outer wireframe orbits represent temporal rings)
    const geometry = new THREE.SphereGeometry(1, 14, 14);
    const material = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // light blue
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Inner Core representing the "Block Hourglass"
    const coreGeo = new THREE.OctahedronGeometry(0.5);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // rose glow
      wireframe: true
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Dynamic rotation corresponding to the simulation speed multiplier
      const rotSpeed = 0.5 + speedMultiplier * 0.15;
      globe.rotation.y = time * rotSpeed;
      globe.rotation.x = time * 0.2;

      core.rotation.y = -time * rotSpeed * 1.5;
      core.scale.setScalar(0.9 + Math.sin(time * 5) * 0.1);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [speedMultiplier]);

  return (
    <div
      ref={mountRef}
      className="w-28 h-28 bg-slate-950/80 border border-sky-500/20 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden shadow-[0_0_25px_rgba(56,189,248,0.15)] group"
      title="Dynamic Chrono Astrolabe"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

interface TimeTravelPanelProps {
  systemDate: string;
  currentStreak: number;
  lastActiveDate: string | null;
  activitiesLoggedToday: string[];
  onFastForward: () => void;
  onSkipDays: (days: number) => void;
  onTeleportToDay: (days: number) => void;
  onResetAll: () => void;
}

export const TimeTravelPanel: React.FC<TimeTravelPanelProps> = ({
  systemDate,
  currentStreak,
  lastActiveDate,
  activitiesLoggedToday,
  onFastForward,
  onSkipDays,
  onTeleportToDay,
  onResetAll
}) => {
  const [teleportDays, setTeleportDays] = useState<number>(14);
  const [skipDaysCount, setSkipDaysCount] = useState<number>(3);

  const isTodayActive = activitiesLoggedToday.length > 0;

  return (
    <div id="time-travel-panel-root" className="bg-gradient-to-br from-sky-950/20 via-slate-950/95 to-rose-950/25 border border-sky-500/25 rounded-3xl p-6 sm:p-8 shadow-[0_0_35px_rgba(56,189,248,0.06)] relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-sky-600/10 via-sky-400/50 to-rose-600/10" />

      {/* Grid of Simulation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (Col 8) */}
        <div className="lg:col-span-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-1.5 bg-slate-900 rounded-lg text-sky-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-syne font-bold text-lg text-slate-100 uppercase tracking-wider">
                Temporal Astrolabe Simulator
              </h3>
              <p className="text-[10px] text-sky-400 font-mono tracking-widest">
                TEMPORAL CHRONICLE DEVIATION
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-space mb-5">
            Manipulate the cosmic fabric of time to test long streak badges or consecutive missed day resets in the Web3 ledger.
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Fast Forward 1 Day */}
            <button
              onClick={onFastForward}
              id="btn-fast-forward-1-day"
              className="w-full bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/30 text-slate-200 p-3.5 rounded-xl transition-all flex items-center justify-between text-xs sm:text-sm cursor-pointer group font-space"
            >
              <div className="flex items-center gap-3">
                <SkipForward className="w-5 h-5 text-sky-400 group-hover:translate-x-1 transition-transform" />
                <div className="text-left">
                  <span className="font-bold block text-slate-200 group-hover:text-sky-400 transition-colors">Fast-Forward 1 Day</span>
                  <span className="text-[10px] text-slate-500 block font-space">Advance chronological state to evaluate daily vow check</span>
                </div>
              </div>
              <span className={`text-[10px] font-space font-bold px-3 py-1 rounded-full ${
                isTodayActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
              }`}>
                {isTodayActive ? 'SECURED' : 'VOW EXPIRED'}
              </span>
            </button>

            {/* Skip Days (Breaks Streak) */}
            <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 flex items-center justify-between gap-3 font-space">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-300 block">Skip Absence:</span>
                <input
                  type="number"
                  min="2"
                  max="15"
                  value={skipDaysCount}
                  onChange={(e) => setSkipDaysCount(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <span className="text-xs text-slate-500">Days</span>
              </div>
              <button
                onClick={() => onSkipDays(skipDaysCount)}
                id="btn-skip-multiple-days"
                className="bg-rose-950/30 hover:bg-rose-900/30 text-rose-300 border border-rose-800/40 hover:border-rose-500 text-xs font-bold py-1.5 px-4 rounded-lg transition-all cursor-pointer"
              >
                Trigger Absence
              </button>
            </div>

            {/* Teleport to Day (Milestone Simulation) */}
            <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 flex items-center justify-between gap-3 font-space">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <span className="text-xs sm:text-sm font-semibold text-slate-300 block">Teleport to Streak:</span>
                <input
                  type="number"
                  min="3"
                  max="100"
                  value={teleportDays}
                  onChange={(e) => setTeleportDays(Math.max(3, parseInt(e.target.value) || 3))}
                  className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <span className="text-xs text-slate-500 font-space">Days</span>
              </div>
              <button
                onClick={() => onTeleportToDay(teleportDays)}
                id="btn-teleport-to-milestone"
                className="bg-sky-950/30 hover:bg-sky-900/30 text-sky-300 border border-sky-800/40 hover:border-sky-500 text-xs font-bold py-1.5 px-4 rounded-lg transition-all cursor-pointer"
              >
                Fast Streak
              </button>
            </div>

            {/* Reset Simulator */}
            <button
              onClick={onResetAll}
              id="btn-reset-simulator-state"
              className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 p-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-mono cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-anchor Timeline to Day 1
            </button>
          </div>
        </div>

        {/* 3D Astrolabe Monitor (Col 4) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-slate-950/40 border border-sky-900/10 rounded-2xl p-5 text-center h-full min-h-[220px]">
          <h5 className="font-syne text-[10px] text-sky-400 font-bold tracking-widest mb-3 uppercase">
            Timeline Orbit State
          </h5>
          <ChronoGlobe3D speedMultiplier={skipDaysCount} />
          <p className="text-[10px] font-space text-slate-500 mt-4 leading-relaxed max-w-[150px] mx-auto">
            Interactive space-time orbits. The astrolabe scales and accelerates as you manipulate absence skipping days.
          </p>
        </div>
      </div>
    </div>
  );
};
