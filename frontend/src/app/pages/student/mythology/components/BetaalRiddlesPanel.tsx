import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Sparkles, AlertCircle, Quote, Compass, Scroll, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityType } from '../types';
import * as THREE from 'three';

export interface Riddle {
  id: string;
  title: string;
  tale: string;
  question: string;
  options: { text: string; id: string; justification: string }[];
  correctOptionId: string;
  explanation: string;
  karmaReward: number;
}

const BETAAL_RIDDLES: Riddle[] = [
  {
    id: 'r1',
    title: "The Curse of the Divergent Branches",
    tale: "Two elite royal commanders, Senapati Veera and Senapati Aditya, were tasked with drafting the state's battle layout. They worked in isolation, copy-modeling the king's master scroll. When they returned, they attempted to merge their scripts. Alack! They had both overwritten the critical third line—Veera insisting on an east-flank cavalry charge, and Aditya insisting on a west-flank archer formation. The royal ledger (Git) halted, flashing a crimson conflict alarm. The commanders drew their swords, accusing each other of rewriting history and corrupting the scroll.",
    question: "Betaal cackles: 'Speak, King Vikram! How must a wise sovereign resolve this Git merge conflict without bloodshed or losing the history of either commander's strategic thoughts?'",
    options: [
      {
        id: 'opt-1',
        text: "Senapati Veera should use 'git push --force' to overwrite Aditya's layout, asserting senior rank.",
        justification: "Wrong! Force-pushing overwrites the shared repository branch and destroys Senapati Aditya's valuable strategic contributions entirely, inviting security chaos."
      },
      {
        id: 'opt-2',
        text: "The King must open the conflicted file, manually inspect both layouts, keep the best of both, delete the conflict markers, and execute a fresh commit.",
        justification: "Correct! The wise sovereign manually resolves the overlapping modifications, decides the cohesive strategy, cleanses the conflict indicators (<<<<<<<, =======, >>>>>>>), and seals the resolution with a merge commit."
      },
      {
        id: 'opt-3',
        text: "The scribe should delete the entire local repository and start copying the master scroll from the beginning of the campaign.",
        justification: "Wrong! Deleting the local repository would discard all the active, unpushed work of both commanders, delaying the royal campaign indefinitely."
      }
    ],
    correctOptionId: 'opt-2',
    explanation: "King Vikram answers: 'The king must act as the manual arbiter, inspect the diffs, select the harmonious path, delete conflict markup, and commit. Force-pushing is the trait of a tyrant, not a wise developer.' Betaal cackles: 'Your wisdom is flawless, Vikram! But because you spoke, I fly back!'",
    karmaReward: 30
  },
  {
    id: 'r2',
    title: "The Quest for the Infinite Union",
    tale: "An ancient hermit in the high mountains of TypeScript agrees to guard the royal gate only if the King can create a chest that holds either a sacred mantra (string) or a ledger of royal numbers (number), but absolutely nothing else. If Vikram tries to place a cursed dark spirit (any) or a royal horse (boolean) into the chest, the chest must trigger a compile-time flash of lightning.",
    question: "Betaal challenges: 'O King! Which static typing protocol of the TypeScript realm must Vikram use to construct this precise, type-safe dual chest?'",
    options: [
      {
        id: 'opt-1',
        text: "The chest must be declared with the absolute 'any' type to allow maximum cosmic freedom.",
        justification: "Wrong! Using 'any' turns off the compiler's protection, allowing cursed objects (like booleans) to enter the chest and defeating the hermit's type-safety constraint."
      },
      {
        id: 'opt-2',
        text: "The chest must be typed using a Union type ('string | number') to strictly bind it to either mantra or count.",
        justification: "Correct! A Union type guarantees that only strings or numbers can ever occupy the variable, catching any invalid assignments during compile-time prior to deployment."
      },
      {
        id: 'opt-3',
        text: "The chest must use a Type Assertion ('chest as string') whenever any item is stored.",
        justification: "Wrong! Type assertions do not change the underlying structure or validate types; they merely silence the compiler without providing real structural safety."
      }
    ],
    correctOptionId: 'opt-2',
    explanation: "King Vikram declares: 'The Union type is the true dual chest, letting the compiler guard the boundary without the dangerous escape hatches of any types.' Betaal cackles: 'Correct! You are indeed the master of types!' and escapes.",
    karmaReward: 30
  },
  {
    id: 'r3',
    title: "The State of the Blooming Lotus",
    tale: "A mystic lake contains a divine lotus. The lotus must bloom whenever the water temperature changes, or whenever the moon enters a new quarter. However, if a priest attempts to adjust the lotus's leaves directly during the temple ritual, the lake plunges into an infinite loop of boiling water, crashing the temple's ecosystem.",
    question: "Betaal asks: 'Tell me, O Vikram! If this lotus is a React component, and the water temperature is a state variable, how must the priest trigger the bloom effect safely without causing infinite re-renders?'",
    options: [
      {
        id: 'opt-1',
        text: "The priest should write a 'useEffect' hook with 'temperature' and 'moon' in its dependency array, and never update temperature directly inside the effect without a condition.",
        justification: "Correct! The useEffect hook is built specifically for side effects. By declaring 'temperature' and 'moon' as dependencies, React runs the bloom logic only when those values change. Avoiding unconditional state updates inside prevents infinite render loops."
      },
      {
        id: 'opt-2',
        text: "The priest should invoke a state setter function ('setTemperature') directly inside the main body of the component function, outside any hook.",
        justification: "Wrong! Setting state directly in the component body triggers a re-render, which immediately calls the body again, invoking the setter, causing an infinite rendering crash."
      },
      {
        id: 'opt-3',
        text: "The priest should store the temperature in a plain global variable ('let temp = 0') and bypass React state entirely.",
        justification: "Wrong! Plain variables do not trigger component updates, meaning the divine lotus would remain unresponsive to temperature changes."
      }
    ],
    correctOptionId: 'opt-1',
    explanation: "King Vikram responds: 'Side effects belong inside useEffect, with primitive, stabilized dependencies. Updating state unconditionally in the rendering path is a sin that causes infinite loops.' Betaal laughs: 'Your React hooks are strong, King!' and flies back to the banyan tree.",
    karmaReward: 30
  },
  {
    id: 'r4',
    title: "The Sentinels of Successive Gates",
    tale: "A high-security palace treasury (API router) stores the king's gold. To reach the inner chamber, a visitor must pass three successive gates. The guard at the first gate verifies the visitor's identity token (authentication); the guard at the second verifies they have the clearance level (authorization); the guard at the third sanitizes their belongings for safety (request validation). Only if all three guards call 'next()' can the visitor meet the Treasurer (Controller) and receive the gold.",
    question: "Betaal cackles: 'Speak, O King! In the architecture of Express, what is the name and proper design pattern of these successive gatekeeping functions?'",
    options: [
      {
        id: 'opt-1',
        text: "They are called 'Controllers' and must be bundled inside a single massive database query.",
        justification: "Wrong! Controllers handle the final response; mixing them with validation and auth into a giant query violates separation of concerns."
      },
      {
        id: 'opt-2',
        text: "They are called 'Middleware functions' and form a sequential request-processing pipeline, with each calling the 'next()' callback to pass control.",
        justification: "Correct! Middleware functions intercept the request-response cycle, allowing developers to modularize security, parsing, and validation checks before the core logic runs."
      },
      {
        id: 'opt-3',
        text: "They are called 'Repositories' and should bypass Express routes to write files directly to disk.",
        justification: "Wrong! Repositories abstract database access and have nothing to do with request-response routing or security gatekeeping."
      }
    ],
    correctOptionId: 'opt-2',
    explanation: "King Vikram speaks: 'They are middlewares. They inspect the request, modify it if necessary, and call next() to pass the visitor to the next guard.' Betaal says: 'Splendidly answered, Vikram!' and flies back to the banyan branches.",
    karmaReward: 30
  },
  {
    id: 'r5',
    title: "The Scroll of Unstructured Deeds",
    tale: "A royal administrator wants to log deeds for the empire. Some citizens own farmlands (fields: crop, size); others own merchant ships (fields: cargo, capacity); others own ancient relics (fields: age, origin). Using a traditional rigid ledger with pre-defined rows and columns makes the ledger massive, mostly empty (filled with NULLs), and impossible to index or query efficiently.",
    question: "Betaal challenges: 'O King! When modeling these highly dynamic and diverse document structures in MongoDB, what core schema modeling pattern should you employ?'",
    options: [
      {
        id: 'opt-1',
        text: "Force all documents into a single SQL table, creating hundreds of columns and filling unused fields with 'null'.",
        justification: "Wrong! This is a relational pattern that causes sparse tables, slows down query performance, and breaks when new property types are introduced."
      },
      {
        id: 'opt-2',
        text: "Leverage MongoDB's dynamic, flexible document schemas (BSON documents), storing custom fields only where applicable and indexing key attributes.",
        justification: "Correct! MongoDB stores data as flexible BSON documents. This lets each deed contain its own set of dynamic properties natively, making polymorphic datasets easy to model and query."
      },
      {
        id: 'opt-3',
        text: "Create a separate database instance for every unique citizen's deed to avoid schema differences.",
        justification: "Wrong! Creating a separate database for every user is an operational nightmare that makes transactions, aggregations, and standard reporting impossible."
      }
    ],
    correctOptionId: 'opt-2',
    explanation: "King Vikram says: 'We must use MongoDB's polymorphic document nature, allowing schema flexibility while enforcing application-level validators where necessary.' Betaal cackles: 'Your knowledge of document schemas is supreme, O Sovereign!' and flies back.",
    karmaReward: 30
  }
];

// Interactive floating 3D Spectral Banyan Orb (Betaal's Spirit)
export function BetaalSpirit3D({ stateAnswered }: { stateAnswered: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = 110;
    const height = 110;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Dynamic color depending on whether user answered or not
    const colorHex = stateAnswered ? 0x10b981 : 0x14b8a6; // emerald or teal

    // Torus knot representing Betaal's complicated riddle-locked spirit
    const geometry = new THREE.TorusKnotGeometry(0.8, 0.25, 64, 8, 3, 5);
    const material = new THREE.MeshPhongMaterial({
      color: colorHex,
      emissive: 0x0f172a,
      shininess: 90,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const knot = new THREE.Mesh(geometry, material);
    scene.add(knot);

    // Glowing spectral particle cloud around it
    const pCount = 30;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const radius = 1.2 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x2dd4bf, // bright teal
      size: 0.18,
      transparent: true,
      opacity: 0.9
    });
    const cloud = new THREE.Points(pGeo, pMat);
    scene.add(cloud);

    // Subtle green/teal directional light
    const dirLight = new THREE.DirectionalLight(0x06b6d4, 1.5);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x0f172a, 0.5);
    scene.add(ambientLight);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Slow dynamic mystical wobble
      knot.rotation.x = time * 0.45;
      knot.rotation.y = time * 0.65;
      knot.position.y = Math.sin(time * 2) * 0.12;

      // Pulse particle orbit
      cloud.rotation.y = -time * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      pGeo.dispose();
      pMat.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [stateAnswered]);

  return (
    <div
      ref={mountRef}
      className="w-28 h-28 bg-slate-950/80 border border-teal-500/20 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden shadow-[0_0_25px_rgba(20,184,166,0.15)] group"
      title="Dynamic Spectral Betaal Orb"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

interface BetaalRiddlesPanelProps {
  onLogActivity: (activityId: string, activityName: string, type: ActivityType, points: number) => void;
  activitiesLoggedToday: string[];
  activeRiddle?: Riddle | null;
  onClearActiveRiddle?: () => void;
  riddleDifficulty?: 'mortal' | 'siddha' | 'yaksha';
}

export const BetaalRiddlesPanel: React.FC<BetaalRiddlesPanelProps> = ({
  onLogActivity,
  activitiesLoggedToday,
  activeRiddle,
  onClearActiveRiddle,
  riddleDifficulty = 'mortal'
}) => {
  const [currentRiddleIdx, setCurrentRiddleIdx] = useState(0);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // If there's a dynamic activeRiddle from the courses study, use it; otherwise fallback to static array
  const riddle = activeRiddle || BETAAL_RIDDLES[currentRiddleIdx];

  // Apply difficulty multipliers
  const difficultyMultiplier = 
    riddleDifficulty === 'siddha' ? 1.15 : 
    riddleDifficulty === 'yaksha' ? 1.35 : 
    1.00;
  
  const finalReward = Math.round(riddle.karmaReward * difficultyMultiplier);

  const handleSelectOption = (optId: string) => {
    if (answered) return;
    setSelectedOptId(optId);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOptId || answered) return;
    
    const correct = selectedOptId === riddle.correctOptionId;
    setIsCorrect(correct);
    setAnswered(true);

    if (correct) {
      onLogActivity(
        `betaal-riddle-${riddle.id}`,
        `Betaal's Riddle Solved: "${riddle.title}" (${riddleDifficulty.toUpperCase()})`,
        'quiz',
        finalReward
      );
    }
  };

  const handleNextRiddle = () => {
    setSelectedOptId(null);
    setAnswered(false);
    setIsCorrect(false);
    if (activeRiddle && onClearActiveRiddle) {
      onClearActiveRiddle();
    } else {
      setCurrentRiddleIdx((prev) => (prev + 1) % BETAAL_RIDDLES.length);
    }
  };

  return (
    <div id="betaal-riddles-panel-root" className="bg-gradient-to-br from-teal-950/20 via-slate-950/95 to-emerald-950/30 border border-teal-500/25 rounded-3xl p-6 sm:p-8 shadow-[0_0_35px_rgba(20,184,166,0.06)] relative overflow-hidden">
      {/* Scroll style top decorative border - Gold Leaf line */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-teal-600/10 via-teal-400/50 to-teal-600/10" />

      {/* Gold Leaf Corner Decors */}
      <div className="absolute top-2 left-2 text-[8px] text-teal-500/20">✦</div>
      <div className="absolute top-2 right-2 text-[8px] text-teal-500/20">✦</div>
      <div className="absolute bottom-2 left-2 text-[8px] text-teal-500/20">✦</div>
      <div className="absolute bottom-2 right-2 text-[8px] text-teal-500/20">✦</div>

      {/* Narrative Legend Meta */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-teal-400">
            <Scroll className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-uncial text-slate-100 tracking-wide text-lg sm:text-xl">
              {activeRiddle ? "Betaal's Live Scroll Riddle" : "The Riddle-Vampire Trial"}
            </h3>
            <p className="text-[10px] text-teal-400 font-mono tracking-widest uppercase">
              BANYAN SPECTRAL FOREST CANOPY
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-space border px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
            activeRiddle 
              ? 'bg-teal-500/10 border-teal-500/40 text-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.2)] animate-pulse' 
              : 'bg-slate-900 border-slate-850 text-slate-400'
          }`}>
            {activeRiddle ? "🔮 Live Vibe Scroll Trial" : "Ancient Manuscript"}
          </span>
          <span className={`text-[9px] font-space border px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1 ${
            riddleDifficulty === 'yaksha'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.255)]'
              : riddleDifficulty === 'siddha'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              : 'bg-slate-900 border-slate-850 text-slate-500'
          }`}>
            ⚖️ {riddleDifficulty.toUpperCase()} ({riddleDifficulty === 'yaksha' ? '+35% KP' : riddleDifficulty === 'siddha' ? '+15% KP' : 'STANDARD'})
          </span>
        </div>
      </div>

      {/* The Core Metaphor Callout - Unique styled box */}
      <div className="bg-teal-950/30 border border-teal-900/30 rounded-xl p-4 mb-6 text-xs text-slate-300 leading-relaxed font-fondamento">
        <p className="flex items-start gap-2.5">
          <AlertCircle className="w-4.5 h-4.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>The Vow of Silence:</strong> If King Vikram speaks to solve the mystery, Betaal escapes back to the ancient banyan canopy. Keep your commitment: <strong>a single missed day releases Betaal and resets your progress to 0.</strong>
          </span>
        </p>
      </div>

      {/* Story Board Grid (Interactive Split Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Story Text Box (Col 8) */}
        <div className="lg:col-span-8 bg-slate-950/60 border border-teal-900/10 rounded-2xl p-5 relative">
          <span className="absolute -top-2.5 left-4 bg-teal-950 border border-teal-500/20 text-[9px] text-teal-400 font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Tale {currentRiddleIdx + 1} of {BETAAL_RIDDLES.length}
          </span>

          <h4 className="text-slate-100 font-cinzel-deco font-bold text-sm sm:text-base mb-3 mt-1 tracking-wider text-teal-400">
            {riddle.title}
          </h4>

          {/* Narrative text block styled as ancient parchment */}
          <div className="relative pl-4 border-l border-teal-500/40 text-sm sm:text-base text-slate-200 leading-relaxed italic my-4 pr-1 max-h-[160px] overflow-y-auto font-fondamento">
            <Quote className="w-8 h-8 text-teal-500/5 absolute -top-2 -left-1 pointer-events-none" />
            <p className="whitespace-pre-line">{riddle.tale}</p>
          </div>

          {/* Betaal's Question Prompt */}
          <div className="mt-4 pt-4 border-t border-slate-900">
            <p className="text-sm font-semibold text-slate-200 flex items-start gap-2 font-uncial tracking-wider">
              <HelpCircle className="w-4.5 h-4.5 text-teal-400 flex-shrink-0 mt-0.5" />
              <span>{riddle.question}</span>
            </p>
          </div>

          {/* Riddle Options Selector */}
          <div className="grid grid-cols-1 gap-2.5 mt-4">
            {riddle.options.map((option) => {
              const isSelected = selectedOptId === option.id;
              const isCorrectOption = option.id === riddle.correctOptionId;

              let optionStyle = "border-slate-850 bg-slate-950/40 hover:border-teal-900/50 text-slate-400 hover:text-slate-200";
              if (isSelected) {
                optionStyle = "border-teal-500/80 bg-teal-950/25 text-teal-200";
              }
              if (answered) {
                if (isCorrectOption) {
                  optionStyle = "border-emerald-500/60 bg-emerald-950/20 text-emerald-300";
                } else if (isSelected) {
                  optionStyle = "border-rose-500/60 bg-rose-950/20 text-rose-300";
                } else {
                  optionStyle = "border-slate-900 opacity-45 text-slate-500";
                }
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={answered}
                  className={`text-left p-3.5 rounded-xl border text-xs sm:text-sm font-space transition-all flex items-start gap-3 cursor-pointer ${optionStyle}`}
                >
                  <div className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center text-[10px] font-mono flex-shrink-0 mt-0.5 ${
                    isSelected ? 'border-teal-400 bg-teal-500/20 text-teal-300' : 'border-slate-700'
                  }`}>
                    {option.id === 'opt-1' ? 'A' : option.id === 'opt-2' ? 'B' : 'C'}
                  </div>
                  <div>
                    <span className="font-semibold block">{option.text}</span>
                    {isSelected && !answered && (
                      <span className="text-[10px] text-teal-400 mt-1 block font-mono">
                        Selected. Click "Submit" to declare your judgement.
                      </span>
                    )}
                    {answered && (isSelected || isCorrectOption) && (
                      <span className="text-[11px] mt-1 block leading-relaxed text-slate-400 font-fondamento">
                        {option.justification}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback Section */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-xl border text-xs sm:text-sm ${
                  isCorrect
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1 font-uncial">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isCorrect ? "Intellect Verified. King Vikram Speaks Wisely!" : "A Rash Judgment, Seeker!"}</span>
                </div>
                <p className="leading-relaxed text-slate-300 mt-1 font-fondamento">
                  {riddle.explanation}
                </p>
                {isCorrect && (
                  <div className="mt-2 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> +{finalReward} KP Added & Streak Fortified!
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Control Buttons */}
          <div className="mt-5 flex gap-3">
            {!answered ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedOptId}
                id={`btn-submit-riddle-${riddle.id}`}
                className="flex-1 bg-teal-950 hover:bg-teal-900 disabled:bg-slate-900 border border-teal-700 disabled:border-slate-850 text-teal-200 disabled:text-slate-500 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm font-space transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(20,184,166,0.15)]"
              >
                <Compass className="w-4 h-4 text-teal-400" /> Submit Judgment to Betaal
              </button>
            ) : (
              <button
                onClick={handleNextRiddle}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer font-uncial"
              >
                Continue to Next Tale <Quote className="w-3 h-3 text-teal-400" />
              </button>
            )}
          </div>
        </div>

        {/* 3D Spirit Orbit Panel (Col 4) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-slate-950/40 border border-teal-900/10 rounded-2xl p-5 text-center h-full min-h-[220px]">
          <h5 className="font-cinzel-deco text-[10px] text-teal-400 font-bold tracking-widest mb-3 uppercase">
            Betaal's Spirit State
          </h5>
          <BetaalSpirit3D stateAnswered={answered} />
          <p className="text-[10px] font-mono text-slate-500 mt-4 leading-relaxed max-w-[150px] mx-auto">
            {answered 
              ? "The 3D torus spirit relaxes. An intellectual breakthrough is synced to the Web3 canopy." 
              : "Orbiting hanging vines hold the current trial key. Drag or click the screen to sway the drift."
            }
          </p>
        </div>
      </div>
    </div>
  );
};
