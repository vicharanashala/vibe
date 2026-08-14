import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, AlertTriangle, Coins, Sparkles, RefreshCw, CheckCircle2, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityType } from '../types';
import * as THREE from 'three';

// 3D Spinning holographic crystal for Spaced Repetition
function RevisionBook3D({ triggerSpin }: { triggerSpin: boolean }) {
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

    // Dynamic color depending on whether user flipped cards recently
    const colorHex = triggerSpin ? 0xa855f7 : 0x6366f1; // purple or indigo

    const geometry = new THREE.OctahedronGeometry(0.9, 0);
    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Faster spinning if triggerSpin is active
      const rotSpeed = triggerSpin ? 3.5 : 1.0;
      mesh.rotation.y = time * 0.6 * rotSpeed;
      mesh.rotation.x = time * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [triggerSpin]);

  return (
    <div ref={mountRef} className="w-20 h-20 bg-slate-950/60 border border-indigo-500/10 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden shadow-inner" />
  );
}

// 3D pulsative unstable crystal for Cognitive Friction
function FrictionCrystal3D({ confusionCleared }: { confusionCleared: boolean }) {
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

    // Color changes to stable emerald once cleared
    const colorHex = confusionCleared ? 0x10b981 : 0xf43f5e; // emerald or rose red

    const geometry = new THREE.IcosahedronGeometry(0.8, 0);
    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      mesh.rotation.y = -time * 0.8;
      mesh.rotation.x = time * 0.4;

      // Pulsate scale to represent unstable friction
      const scaleBase = confusionCleared ? 1.0 : 1.0 + Math.sin(time * 6.0) * 0.15;
      mesh.scale.set(scaleBase, scaleBase, scaleBase);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [confusionCleared]);

  return (
    <div ref={mountRef} className="w-20 h-20 bg-slate-950/60 border border-rose-500/10 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden shadow-inner" />
  );
}

interface SynergyPanelProps {
  karmaPoints: number;
  onLogActivity: (activityId: string, activityName: string, type: ActivityType, points: number) => void;
  activitiesLoggedToday: string[];
}

export const SynergyPanel: React.FC<SynergyPanelProps> = ({
  karmaPoints,
  onLogActivity,
  activitiesLoggedToday
}) => {
  // Spaced Repetition state
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [spacedRepCompleted, setSpacedRepCompleted] = useState(false);

  // Confusion Tracker state
  const [confusionItem, setConfusionItem] = useState({
    concept: 'Dijkstra Pathfinding Edge Relaxation',
    score: '9.2 / 10',
    details: 'Why do we need to re-verify node coordinates if non-negative weights are guaranteed?'
  });
  const [confusionCleared, setConfusionCleared] = useState(false);

  const flashcards = [
    { q: "What does King Vikram's lantern symbolize in the legend?", a: "The light of intellectual focus illuminating a dark, chaotic path of study." },
    { q: "How does Spaced Repetition help with long-term memory retention?", a: "By reviewing concepts at mathematically calculated intervals when you are just about to forget them." },
    { q: "Who is Betaal in the context of ViBe learning science?", a: "The ultimate tester of King Vikram, representing hard riddles, quizzes, and cognitive friction." }
  ];

  const handleNextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setFlashcardIndex((prev) => (prev + 1) % flashcards.length);
    }, 200);
  };

  const completeFlashcardRevision = () => {
    onLogActivity('spaced-rep', 'Spaced Repetition Flashcard', 'spaced-rep', 15);
    setSpacedRepCompleted(true);
    setTimeout(() => setSpacedRepCompleted(false), 3000);
  };

  const completeConfusionRevision = () => {
    onLogActivity('confusion', 'Confusion Score Revision', 'confusion', 20);
    setConfusionCleared(true);
    setTimeout(() => setConfusionCleared(false), 3000);
  };

  return (
    <div id="synergy-panel-root" className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Spaced Repetition Card */}
      <div className="bg-gradient-to-br from-indigo-950/20 via-slate-950/95 to-purple-950/20 border border-indigo-500/25 rounded-3xl p-6 shadow-[0_0_35px_rgba(99,102,241,0.06)] flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full font-space uppercase font-bold tracking-wider">
              Spaced Repetition
            </span>
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-bold">
              <Coins className="w-3.5 h-3.5 animate-bounce" /> +15 KP
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-syne tracking-wider uppercase">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Daily Flashcard Revision
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-space">
                Reviewing a single card triggers your Daily Streak and reinforces memory.
              </p>
            </div>
            {/* Interactive 3D Card Stack Spinner */}
            <RevisionBook3D triggerSpin={isFlipped} />
          </div>
          
          {/* Interactive Flashcard widget */}
          <div className="my-5 min-h-[140px] perspective-1000">
            <AnimatePresence mode="wait">
              <motion.div
                key={flashcardIndex + (isFlipped ? '-back' : '-front')}
                initial={{ opacity: 0, rotateY: isFlipped ? -90 : 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: isFlipped ? 90 : -90 }}
                transition={{ duration: 0.25 }}
                onClick={() => setIsFlipped(!isFlipped)}
                className={`w-full min-h-[130px] rounded-2xl border p-4.5 flex flex-col justify-between cursor-pointer select-none relative overflow-hidden transition-all duration-300 ${
                  isFlipped
                    ? 'bg-indigo-950/30 border-indigo-500/40 shadow-[0_0_20px_rgba(79,70,229,0.05)]'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/30'
                }`}
              >
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-2">
                    {isFlipped ? 'Answer Key (Flip back)' : 'Front of Card (Tap to Flip)'}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 mt-1 font-semibold leading-relaxed font-space">
                    {isFlipped ? flashcards[flashcardIndex].a : flashcards[flashcardIndex].q}
                  </p>
                </div>
                
                <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                  <span>Card {flashcardIndex + 1} of {flashcards.length}</span>
                  <span className="text-indigo-400 font-bold uppercase tracking-wider">Tap to flip 🔀</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-2.5 mt-2">
          <button
            onClick={completeFlashcardRevision}
            disabled={activitiesLoggedToday.includes('spaced-rep')}
            id="btn-complete-spaced-rep"
            className="flex-1 bg-indigo-950/40 hover:bg-indigo-900/40 disabled:bg-slate-950 disabled:text-slate-600 text-indigo-300 disabled:border-slate-900 border border-indigo-800/40 hover:border-indigo-500 font-bold py-2.5 px-3 rounded-xl text-xs font-space transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.1)]"
          >
            {activitiesLoggedToday.includes('spaced-rep') ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Reviewed Today
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> Finish Revision
              </>
            )}
          </button>
          <button
            onClick={handleNextCard}
            className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1 border border-slate-900 cursor-pointer font-space"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Next
          </button>
        </div>
      </div>

      {/* 2. Confusion Score Tracker Card */}
      <div className="bg-gradient-to-br from-rose-950/20 via-slate-950/95 to-slate-950 border border-rose-500/25 rounded-3xl p-6 shadow-[0_0_35px_rgba(244,63,94,0.06)] flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2.5 py-1 rounded-full font-space uppercase font-bold tracking-wider">
              Cognitive Friction
            </span>
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono font-bold">
              <Coins className="w-3.5 h-3.5 animate-bounce" /> +20 KP
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-syne tracking-wider uppercase">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> High-Confusion Revision
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-space">
                Revisiting concepts you flagged as highly confusing counts as active streak engagement.
              </p>
            </div>
            {/* Interactive Unstable 3D Star Crystal */}
            <FrictionCrystal3D confusionCleared={activitiesLoggedToday.includes('confusion') || confusionCleared} />
          </div>

          {/* Confusion Item Block */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4.5 my-5">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                ⚠️ Friction: {confusionItem.score}
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Concept Log</span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-200 mt-2 font-space">{confusionItem.concept}</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed italic font-space">
              "{confusionItem.details}"
            </p>
          </div>
        </div>

        <button
          onClick={completeConfusionRevision}
          disabled={activitiesLoggedToday.includes('confusion')}
          id="btn-complete-confusion-clear"
          className="w-full bg-rose-950/40 hover:bg-rose-900/40 disabled:bg-slate-950 disabled:text-slate-600 text-rose-300 disabled:border-slate-900 border border-rose-800/40 hover:border-rose-500 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm font-space transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.1)]"
        >
          {activitiesLoggedToday.includes('confusion') ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Re-verified Today
            </>
          ) : (
            <>
              <Bookmark className="w-4 h-4 text-rose-400 animate-pulse" /> Re-verify Confusing Concept
            </>
          )}
        </button>
      </div>
    </div>
  );
};
