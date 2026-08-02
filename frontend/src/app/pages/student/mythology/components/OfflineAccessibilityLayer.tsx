import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, Wifi, WifiOff, Send, HelpCircle, CheckCircle, Sparkles, Volume2, VolumeX, Ghost } from 'lucide-react';
import { logOfflineActiveDate, getOfflineActiveMetrics, OfflineMetric } from '../utils/indexedDB';
import { queueActivityInPouch, syncOfflineDataToServer, getPendingPouchDocs } from '../utils/pouchSync';
import { encryptData, decryptData } from '../utils/crypto';

// Secure localStorage helpers for the offline chat queue
const getSecureQueue = (sessionKey: string | null): any[] => {
  if (!sessionKey) {
    try { return JSON.parse(localStorage.getItem('vibe_offline_chat_queue') || '[]'); } catch { return []; }
  }
  try {
    const encrypted = localStorage.getItem('vibe_offline_chat_queue');
    if (!encrypted) return [];
    const result = decryptData(encrypted, sessionKey);
    return Array.isArray(result) ? result : [];
  } catch { return []; }
};

const saveSecureQueue = (queue: any[], sessionKey: string | null) => {
  try {
    if (!sessionKey) {
      localStorage.setItem('vibe_offline_chat_queue', JSON.stringify(queue));
    } else {
      localStorage.setItem('vibe_offline_chat_queue', encryptData(queue, sessionKey));
    }
  } catch {}
};


interface OfflineAccessibilityLayerProps {
  currentStreak: number;
  lastActiveDate: string | null;
  systemDate: string;
  activitiesLoggedToday: string[];
  isSimulatedOffline: boolean;
  setIsSimulatedOffline: (val: boolean) => void;
  onSyncComplete: (syncResults: {
    updatedStreak: number;
    updatedLastActiveDate: string;
    newBadgesUnlocked: string[];
    karmaGained: number;
  }) => void;
  onLogActivity: (id: string, name: string, type: 'spaced-rep' | 'quiz' | 'video' | 'confusion' | 'question', points: number) => void;
  courses: any[];
  sessionKey: string | null;
}

// Custom hook to handle Web Audio API synthesized bird song soundscape and sound effects
const useForestSounds = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const melodyTimeoutRef = useRef<any>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const startSoundscape = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (masterGainRef.current) return; // Already playing

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, ctx.currentTime);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    const playNextNote = () => {
      const currentCtx = audioCtxRef.current;
      const currentGain = masterGainRef.current;
      if (!currentCtx || !currentGain || currentCtx.state === 'suspended') return;

      const now = currentCtx.currentTime;
      const freq = scale[Math.floor(Math.random() * scale.length)];

      const osc = currentCtx.createOscillator();
      const noteGain = currentCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.05, now + 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(noteGain);
      noteGain.connect(currentGain);

      osc.start(now);
      osc.stop(now + 2.6);

      const nextTime = 2000 + Math.random() * 2000;
      melodyTimeoutRef.current = setTimeout(playNextNote, nextTime);
    };

    playNextNote();
    setIsPlaying(true);
  };

  const stopSoundscape = () => {
    if (melodyTimeoutRef.current) {
      clearTimeout(melodyTimeoutRef.current);
      melodyTimeoutRef.current = null;
    }

    if (masterGainRef.current) {
      try {
        masterGainRef.current.disconnect();
      } catch (e) {}
      masterGainRef.current = null;
    }
    
    setIsPlaying(false);
  };

  // Synthesize a cute, soft playful bubble pop sound instead of ghost wobble
  const playGhostGiggle = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Fast frequency sweep upwards to make a "pop"
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  };

  // Synthesize chime sound when offline activity is saved
  const playChime = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((f, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + index * 0.06);

      gain.gain.setValueAtTime(0, now + index * 0.06);
      gain.gain.linearRampToValueAtTime(0.04, now + index * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.06 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.5);
    });
  };

  // Synthesize magical sync chime
  const playSyncSuccessSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const freq = 400 + i * 150;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.05, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.3);
    }
  };

  return { isPlaying, startSoundscape, stopSoundscape, playGhostGiggle, playChime, playSyncSuccessSound };
};

export const OfflineAccessibilityLayer: React.FC<OfflineAccessibilityLayerProps> = ({
  currentStreak,
  lastActiveDate,
  systemDate,
  activitiesLoggedToday,
  isSimulatedOffline,
  setIsSimulatedOffline,
  onSyncComplete,
  onLogActivity,
  courses,
  sessionKey
}) => {
  const { isPlaying, startSoundscape, stopSoundscape, playGhostGiggle, playChime, playSyncSuccessSound } = useForestSounds();

  // Mode toggles
  const [pouchCount, setPouchCount] = useState(0);
  const [syncedLogs, setSyncedLogs] = useState<OfflineMetric[]>([]);

  // Pre-caching status state
  const [preCacheStatus, setPreCacheStatus] = useState<{
    active: boolean;
    current: number;
    total: number;
    completed: boolean;
  }>({
    active: false,
    current: 0,
    total: 0,
    completed: false
  });

  const handlePreCacheAll = async () => {
    if (preCacheStatus.active) return;
    
    // Collect all lesson objects
    const allLessonsToCache: Array<{ category: string; lesson: string }> = [];
    courses.forEach(course => {
      if (course && course.lessons) {
        course.lessons.forEach((lesson: string) => {
          allLessonsToCache.push({ category: course.category, lesson });
        });
      }
    });

    if (allLessonsToCache.length === 0) {
      alert("No lessons found to pre-cache.");
      return;
    }

    setPreCacheStatus({
      active: true,
      current: 0,
      total: allLessonsToCache.length,
      completed: false
    });

    const cache = await caches.open('vibe-offline-cache-v2');

    // Fetch and cache each lesson sequentially for reliability
    for (let i = 0; i < allLessonsToCache.length; i++) {
      const item = allLessonsToCache[i];
      const url = `/api/lesson-content?category=${encodeURIComponent(item.category)}&lesson=${encodeURIComponent(item.lesson)}`;
      
      try {
        const response = await fetch(url);
        if (response.status === 200) {
          await cache.put(url, response.clone());
        }
      } catch (err) {
        console.error(`Failed to pre-cache lesson ${item.lesson}`, err);
      }

      setPreCacheStatus(prev => ({
        ...prev,
        current: i + 1
      }));
    }

    setPreCacheStatus(prev => ({
      ...prev,
      completed: true,
      active: false
    }));
    
    playSyncSuccessSound();
  };

  // Flashcards state
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardScores, setFlashcardScores] = useState<boolean[]>([false, false, false]);

  // Local Chatbot QA State
  const [botChatLogs, setBotChatLogs] = useState<{ sender: 'user' | 'betaal', text: string }[]>([
    { sender: 'betaal', text: "Hahaha! Vikram, though your device loses its connection to the skies, I am bound to your mind. Ask me any software engineering riddle offline!" }
  ]);
  const [botQuery, setBotQuery] = useState('');
  const [tfjsStatus, setTfjsStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [tfjsProgress, setTfjsProgress] = useState(0);

  const FLASHCARDS = [
    {
      id: "fc-1",
      question: "How does the Service Worker act in an offline-first architecture?",
      answer: "It intercepts network requests as a proxy, serving cached resources immediately when the network is absent, and caching new GET API results.",
      hint: "Acts as an on-device local proxy gate."
    },
    {
      id: "fc-2",
      question: "What is PouchDB's relationship to CouchDB for syncing?",
      answer: "PouchDB runs directly in browser storage (IndexedDB) and replicates conflict-free changes bidirectionally to remote CouchDB-compatible databases when online.",
      hint: "Bidirectional master-to-master replication engine."
    },
    {
      id: "fc-3",
      question: "Why use IndexedDB instead of standard LocalStorage for offline tracking?",
      answer: "IndexedDB provides structured, transactional, asynchronous storage suitable for binary content or deep logs, preventing blocking of the main rendering thread.",
      hint: "Transactional key-value structured database."
    }
  ];

  // Refresh local queues counter
  const updatePendingCount = async () => {
    try {
      const pouchDocs = await getPendingPouchDocs();
      const indexedMetrics = await getOfflineActiveMetrics();
      setPouchCount(pouchDocs.length);
      setSyncedLogs(indexedMetrics);
    } catch (err) {
      console.warn("Failed to check pending counts", err);
    }
  };

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle local offline flashcard session completed
  const handleCompleteFlashcardOffline = async () => {
    const activityId = "offline-flashcards";
    const activityName = "Completed 5-Min Offline Concept Flashcard Deck";

    playChime();

    if (isSimulatedOffline) {
      // 1. Log to IndexedDB
      await logOfflineActiveDate(
        activityId,
        activityName,
        'spaced-rep',
        'vibe-pwa-review',
        currentStreak,
        lastActiveDate,
        systemDate
      );

      // 2. Queue in PouchDB
      await queueActivityInPouch({
        activityId,
        activityName,
        activityType: 'spaced-rep',
        courseId: 'vibe-pwa-review',
        systemDate
      });

      await updatePendingCount();
      onLogActivity(activityId, `${activityName} (Queued Offline)`, 'spaced-rep', 25);
    } else {
      // Direct Online Logging
      onLogActivity(activityId, activityName, 'spaced-rep', 25);
    }

    setFlashcardScores([false, false, false]);
    setActiveCardIndex(0);
    setShowAnswer(false);
  };

  // Perform Synchronization to the Remote Sovereign Database
  const handlePerformSync = async () => {
    if (isSimulatedOffline) {
      alert("⚠️ You are currently in Simulated Offline mode! Please toggle back to 'Online' to synchronize databases.");
      return;
    }

    const results = await syncOfflineDataToServer(currentStreak, lastActiveDate);
    if (results && results.success) {
      playSyncSuccessSound();
      onSyncComplete({
        updatedStreak: results.updatedStreak,
        updatedLastActiveDate: results.updatedLastActiveDate,
        newBadgesUnlocked: results.newBadgesUnlocked,
        karmaGained: results.karmaGained
      });
      await updatePendingCount();
    }
  };

  // Chat handler — routes to real Cohere AI API (online) or queues for later (offline)
  const handleQueryLocalBot = async () => {
    if (!botQuery.trim()) return;

    const userText = botQuery;
    setBotChatLogs(prev => [...prev, { sender: 'user', text: userText }]);
    setBotQuery('');

    if (!isSimulatedOffline) {
      // ===== ONLINE MODE: Call real Cohere AI API, also flush any queued offline questions =====
      setTfjsStatus('loading');
      setTfjsProgress(30);
      try {
        // Flush offline queue first (silently)
        const storedQueue = getSecureQueue(sessionKey);
        if (storedQueue.length > 0) {
          for (const item of storedQueue) {
            try {
              const r = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer temp_token`
                },
                body: JSON.stringify({ message: item.message, conversationHistory: [] })
              });
              if (r.ok) {
                const d = await r.json();
                const queuedAnswerEntry = { sender: 'betaal' as const, text: `📤 [Queued Answer for "${item.message}"]: ${d.reply}` };
                setBotChatLogs(prev => [...prev, queuedAnswerEntry]);
              }
            } catch (e) {}
          }
          saveSecureQueue([], sessionKey);
        }

        // Build conversation history for context
        const conversationHistory = botChatLogs.slice(-8).map(log => ({
          role: log.sender === 'user' ? 'user' : 'model',
          text: log.text
        }));

        setTfjsProgress(70);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer temp_token`
          },
          body: JSON.stringify({ message: userText, conversationHistory })
        });

        setTfjsProgress(100);
        setTfjsStatus('ready');

        if (response.ok) {
          const data = await response.json();
          setBotChatLogs(prev => [...prev, { sender: 'betaal', text: data.reply }]);
        } else {
          // If Cohere API fails, gracefully fallback to local offline knowledge
          const reply = getOfflineBotReply(userText);
          setBotChatLogs(prev => [...prev, {
            sender: 'betaal',
            text: `⚠️ [API Quota Exceeded — Falling back to local wisdom]\n\n${reply}`
          }]);
          playGhostGiggle();
        }
      } catch (err) {
        setTfjsStatus('ready');
        // If network error, gracefully fallback to local offline knowledge
        const reply = getOfflineBotReply(userText);
        setBotChatLogs(prev => [...prev, {
          sender: 'betaal',
          text: `🌐 [Network Error — Falling back to local wisdom]\n\n${reply}`
        }]);
        playGhostGiggle();
        
        // Queue this question for later
        try {
          if (sessionKey) {
            const q = getSecureQueue(sessionKey);
            q.push({ message: userText, timestamp: new Date().toISOString() });
            saveSecureQueue(q, sessionKey);
          }
        } catch (e) {}
      }
    } else {
      // ===== OFFLINE MODE: Local keyword-matching + QUEUE question for real answer when online =====
      setTfjsStatus('ready');
      const reply = getOfflineBotReply(userText);
      setBotChatLogs(prev => {
        const updated = [...prev, { sender: 'betaal' as const, text: reply }];
        return updated;
      });
      // Queue the question to get a real AI answer when back online
      try {
        if (sessionKey) {
          const q = getSecureQueue(sessionKey);
          q.push({ message: userText, timestamp: new Date().toISOString() });
          saveSecureQueue(q, sessionKey);
        }
      } catch (e) {}
      playGhostGiggle();
    }
  };

  // Offline fallback — comprehensive local knowledge base
  const getOfflineBotReply = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('service worker') || q.includes('sw')) {
      return "🔒 [Offline] A Service Worker is a script that runs in the background, intercepting network requests. It acts as a proxy between browser and network — serving cached resources when offline, enabling push notifications, and providing background sync. Register it with `navigator.serviceWorker.register('/sw.js')`.";
    } else if (q.includes('pouch') || q.includes('couch') || q.includes('sync')) {
      return "🔄 [Offline] PouchDB runs in browser storage (IndexedDB) and replicates bidirectionally to remote CouchDB when online. Use `new PouchDB('mydb')` locally, then `db.sync('http://remote:5984/mydb')` for seamless offline-first data synchronization.";
    } else if (q.includes('indexed') || q.includes('idb')) {
      return "💾 [Offline] IndexedDB is an async, transactional browser database for storing structured data, blobs, and files. Unlike localStorage (5MB, sync), IndexedDB handles GBs asynchronously without blocking the main thread. Use `indexedDB.open('db', 1)` to get started.";
    } else if (q.includes('react') || q.includes('hook') || q.includes('component')) {
      return "⚛️ [Offline] React components are reusable UI building blocks. Hooks like `useState` manage local state, `useEffect` handles side effects, `useMemo`/`useCallback` optimize performance, and `useRef` accesses DOM elements. Zustand is recommended for global state in the ViBe curriculum.";
    } else if (q.includes('typescript') || q.includes('type') || q.includes('interface')) {
      return "📘 [Offline] TypeScript adds static typing to JavaScript. Key concepts: `interface` for object shapes, `type` aliases for unions/intersections, `generics` for reusable typed functions like `function identity<T>(arg: T): T { return arg; }`, and `decorators` for meta-programming.";
    } else if (q.includes('express') || q.includes('middleware') || q.includes('api') || q.includes('rest')) {
      return "🚀 [Offline] Express.js is a Node.js framework for building REST APIs. Middleware functions process requests in a pipeline: `app.use((req, res, next) => { /* logic */ next(); })`. Use the MVC pattern to separate routes, controllers, and models for scalability.";
    } else if (q.includes('mongo') || q.includes('database') || q.includes('crud') || q.includes('schema')) {
      return "🗃️ [Offline] MongoDB is a document database storing JSON-like documents. CRUD: `db.collection.insertOne()`, `find()`, `updateOne()`, `deleteOne()`. The Aggregation Framework (`$match`, `$group`, `$project`) enables complex data transformations in pipelines.";
    } else if (q.includes('git') || q.includes('github') || q.includes('branch') || q.includes('commit')) {
      return "🔀 [Offline] Git is a distributed version control system. Key commands: `git add .`, `git commit -m 'msg'`, `git push origin main`, `git branch feature-x`, `git merge`. GitHub adds remote collaboration with pull requests, code reviews, and CI/CD integrations.";
    } else if (q.includes('streak') || q.includes('habit') || q.includes('daily')) {
      return "🔥 [Offline] Your streak tracks consecutive days of learning activity. Any valid action (flashcard, quiz, video, lesson) counts. The ViBe PWA stores your activity timestamp in IndexedDB even offline — your streak is protected as long as you engage daily!";
    } else if (q.includes('cache') || q.includes('offline') || q.includes('pwa')) {
      return "📱 [Offline] A Progressive Web App (PWA) uses Service Workers + Cache API for offline access. The cache-first strategy serves stored resources instantly. Use `caches.open('v1')` and `cache.put(request, response)` to manually control what's available offline.";
    }

    return `📖 [Offline] I'm running locally without server access. I can answer questions about: Service Workers, PouchDB/CouchDB sync, IndexedDB, React hooks, TypeScript types, Express middleware, MongoDB CRUD, Git commands, PWA caching, and streak mechanics. Try asking about one of these topics!`;
  };

  return (
    <div
      id="offline-accessibility-layer-root"
      className={`w-full rounded-2xl p-6 relative overflow-hidden backdrop-blur-md mt-6 transition-all duration-700 ${
        isSimulatedOffline
          ? 'bg-amber-950/10 border border-amber-500/25 shadow-[0_0_40px_rgba(245,158,11,0.08)]'
          : 'bg-slate-950/85 border border-emerald-500/25 shadow-[0_0_40px_rgba(16,185,129,0.05)]'
      }`}
    >
      
      {/* Stars Backdrop Atmosphere */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
      
      {/* Decorative Star Constellations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-8 left-[10%] w-1.5 h-1.5 bg-yellow-200 rounded-full animate-ping duration-[3000ms]" />
        <div className="absolute top-16 left-[45%] w-1 h-1 bg-amber-100 rounded-full animate-pulse duration-1000" />
        <div className="absolute top-24 left-[80%] w-2 h-2 bg-indigo-300 rounded-full animate-ping duration-[4000ms]" />
        <div className="absolute top-4 left-[90%] w-1 h-1 bg-white rounded-full animate-pulse duration-700" />
      </div>

      {/* Floating Ghosts & Interactive Minions */}
      <div className="absolute top-6 right-8 flex items-center gap-3">
        {/* Playful Ambient sound master control */}
        <button
          onClick={isPlaying ? stopSoundscape : startSoundscape}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
            isPlaying 
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' 
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Synthesizes relaxing background forest audio & crickets chirp natively!"
        >
          {isPlaying ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{isPlaying ? "FOREST AMBIENT: ON" : "SOUNDSCAPE MUTE"}</span>
        </button>

        {/* Cute Floating Interactive Ghost */}
        <button
          onClick={() => {
            playGhostGiggle();
            alert("👻 Betaal's forest helper giggle synthesized!");
          }}
          className="p-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:text-indigo-100 hover:bg-indigo-500/20 transition-all hover:scale-110 active:scale-90 relative group"
          title="Click to summon Betaal's helpful spirit!"
        >
          <Ghost className="w-4 h-4 animate-bounce" />
          <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-300 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300">
            Hi! Play Chime
          </span>
        </button>
      </div>

      {/* Header and Sync Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold uppercase rounded tracking-wider transition-all duration-500 ${
              isSimulatedOffline
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {isSimulatedOffline ? '📴 Offline Sanctuary' : '🌐 Online Mode'}
            </span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${isSimulatedOffline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-[10px] text-slate-400 font-mono">{isSimulatedOffline ? 'Cache Serving' : 'PWA Cache Ready'}</span>
            </div>
          </div>
          <h2 className="text-sm font-serif font-bold text-slate-100 tracking-wider uppercase mt-1 flex items-center gap-2">
            {isSimulatedOffline ? '🔒 Offline-First PWA Sanctuary' : '🌳 Starry Forest PWA Sanctuary'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {isSimulatedOffline
              ? 'You are in isolation mode. Complete flashcards or query Betaal AI below — activities queue locally and sync when you reconnect.'
              : 'Spend 5 minutes offline solving the concept flashcards or querying Betaal to maintain your streak without any internet connection.'}
          </p>

          {/* Real pre-caching feature for Vibe github repository */}
          <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-3 max-w-xl">
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wide">Synchronize Real Vibe Curriculum</span>
              </div>
              <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                {preCacheStatus.completed 
                  ? "✓ Entire real curriculum is successfully downloaded and fully available offline!"
                  : "Download all 35+ lessons of the real repository into your browser's persistent cache for genuine offline study."}
              </p>
            </div>
            
            {preCacheStatus.active ? (
              <div className="flex flex-col items-end gap-1 min-w-[120px]">
                <span className="text-[9px] font-mono text-indigo-400 font-bold">
                  Caching: {preCacheStatus.current} / {preCacheStatus.total}
                </span>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${(preCacheStatus.current / preCacheStatus.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : preCacheStatus.completed ? (
              <span className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold rounded-lg whitespace-nowrap">
                ✓ ALL CACHED
              </span>
            ) : (
              <button
                onClick={handlePreCacheAll}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md"
              >
                PRE-CACHE ALL LESSONS
              </button>
            )}
          </div>
        </div>

        {/* Online / Offline simulated toggle switch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Dramatic Online/Offline toggle with clear visual difference */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border transition-all duration-500 ${
            isSimulatedOffline
              ? 'bg-amber-950/40 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              : 'bg-emerald-950/40 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
          }`}>
            <button
              onClick={() => {
                setIsSimulatedOffline(false);
                playChime();
              }}
              className={`relative px-4 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-2 transition-all duration-300 ${
                !isSimulatedOffline
                  ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105'
                  : 'text-slate-500 hover:text-slate-300 scale-100'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>ONLINE</span>
              {!isSimulatedOffline && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => {
                setIsSimulatedOffline(true);
                playGhostGiggle();
              }}
              className={`relative px-4 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-2 transition-all duration-300 ${
                isSimulatedOffline
                  ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105'
                  : 'text-slate-500 hover:text-slate-300 scale-100'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>OFFLINE</span>
              {isSimulatedOffline && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-950 animate-bounce" />
              )}
            </button>
          </div>

          {/* Current mode banner — big visible state label */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-mono font-bold transition-all duration-500 ${
            isSimulatedOffline
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-400'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
          }`}>
            {isSimulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span>ISOLATION MODE — Activities queue locally</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>CONNECTED — Changes sync in real-time</span>
              </>
            )}
          </div>

          <button
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const reg of regs) {
                    await reg.unregister();
                  }
                }
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                  await caches.delete(name);
                }
                window.location.reload();
              } catch (e) {
                console.error('Failed to purge caches', e);
                window.location.reload();
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 text-[10px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Wipes Service Worker cache databases and triggers a hard reload to display newest code edits immediately."
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>FORCE BUST CACHE & UPDATE</span>
          </button>
        </div>
      </div>

      {/* === DRAMATIC MODE INDICATOR STRIP === */}
      <div className={`-mx-6 px-6 py-2.5 mb-5 flex items-center gap-3 transition-all duration-700 ${
        isSimulatedOffline
          ? 'bg-gradient-to-r from-amber-950/60 via-amber-900/20 to-transparent border-y border-amber-500/20'
          : 'bg-gradient-to-r from-emerald-950/60 via-emerald-900/20 to-transparent border-y border-emerald-500/20'
      }`}>
        <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${
          isSimulatedOffline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
        }`} />
        <p className={`text-[10px] font-mono font-bold tracking-wide ${
          isSimulatedOffline ? 'text-amber-300' : 'text-emerald-300'
        }`}>
          {isSimulatedOffline
            ? '📴 OFFLINE SANCTUARY ACTIVE — Your session is air-gapped. Activities are stored in PouchDB/IndexedDB and will sync when you reconnect.'
            : '🌐 LIVE CONNECTION — All activities sync immediately to the ViBe platform. Streak progress updates in real-time.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: PouchDB & IndexedDB Queue (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 border border-slate-900/80 rounded-xl p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase mb-1.5 flex items-center gap-1.5 border-b border-slate-950 pb-1.5">
                💾 Sync & Database Monitor
              </h3>
              
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Local PouchDB Database:</span>
                  <span className="text-indigo-400 font-bold">{pouchCount} docs pending</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">IndexedDB Timestamp:</span>
                  <span className="text-amber-400 font-bold">
                    {syncedLogs.length > 0 ? syncedLogs[syncedLogs.length - 1].local_active_date : 'No offline logs'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Simulated Network Status:</span>
                  <span className={`font-bold flex items-center gap-1 ${isSimulatedOffline ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {isSimulatedOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                    {isSimulatedOffline ? "Offline Sim" : "Online"}
                  </span>
                </div>
              </div>

              {/* Offline metrics list */}
              {syncedLogs.length > 0 && (
                <div className="mt-4 bg-slate-950/60 border border-slate-900 rounded-lg p-2 max-h-[110px] overflow-y-auto">
                  <p className="text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1">IndexedDB Log Record</p>
                  {syncedLogs.map((log, i) => (
                    <div key={i} className="text-[10px] font-mono text-slate-300 flex justify-between py-0.5 border-b border-slate-900 last:border-0">
                      <span className="truncate max-w-[120px]">📝 {log.activityName}</span>
                      <span className="text-indigo-400">{log.local_active_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-950">
              <button
                onClick={handlePerformSync}
                disabled={pouchCount === 0 || isSimulatedOffline}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-900 disabled:to-slate-900 border border-emerald-500/30 disabled:border-slate-800 text-slate-950 disabled:text-slate-500 font-serif font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Synchronize to Sovereign Vault</span>
              </button>
              <p className="text-[9px] font-mono text-slate-500 text-center mt-2 leading-tight">
                Pushes PouchDB and IndexedDB local metrics to remote CouchDB & main platform server variables, checking for milestone badges!
              </p>
            </div>
          </div>
        </div>

        {/* COLUMN 2: 5-Minute Concept Review & Flashcards (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 border border-slate-900/80 rounded-xl p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase mb-1.5 flex items-center gap-1.5 border-b border-slate-950 pb-1.5">
                ⚡ 5-Min Concept flashcard deck
              </h3>

              <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative min-h-[140px] flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                    <span>FLASHCARD {activeCardIndex + 1} OF 3</span>
                    <span className="text-indigo-400">Habit Saver</span>
                  </div>
                  
                  <p className="text-xs font-semibold text-slate-100 mt-2.5">
                    {FLASHCARDS[activeCardIndex].question}
                  </p>

                  {showAnswer && (
                    <p className="text-[11px] text-emerald-400 mt-2.5 bg-emerald-950/20 border border-emerald-500/10 p-2 rounded-lg leading-relaxed font-mono">
                      💡 {FLASHCARDS[activeCardIndex].answer}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  {!showAnswer ? (
                    <button
                      onClick={() => {
                        setShowAnswer(true);
                        playChime();
                      }}
                      className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono py-1 rounded cursor-pointer transition-all"
                    >
                      Show Secret Answer
                    </button>
                  ) : (
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => {
                          const updated = [...flashcardScores];
                          updated[activeCardIndex] = true;
                          setFlashcardScores(updated);
                          playChime();
                          
                          if (activeCardIndex < 2) {
                            setActiveCardIndex(activeCardIndex + 1);
                            setShowAnswer(false);
                          } else {
                            handleCompleteFlashcardOffline();
                          }
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-slate-950 text-[10px] font-mono py-1 rounded cursor-pointer font-bold transition-all"
                      >
                        Got It! {activeCardIndex === 2 ? 'Finish' : 'Next'}
                      </button>
                      <button
                        onClick={() => {
                          if (activeCardIndex < 2) {
                            setActiveCardIndex(activeCardIndex + 1);
                            setShowAnswer(false);
                          } else {
                            handleCompleteFlashcardOffline();
                          }
                        }}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-mono py-1 rounded cursor-pointer transition-all"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-950">
              <div className="flex gap-1 justify-center">
                {FLASHCARDS.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeCardIndex 
                        ? 'w-6 bg-indigo-500' 
                        : i < activeCardIndex 
                          ? 'w-2 bg-emerald-500' 
                          : 'w-2 bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: ViBe AI Chatbot — Cohere AI online, local offline */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className={`bg-slate-900/60 border rounded-xl p-4 flex-1 flex flex-col justify-between transition-all duration-500 ${
            isSimulatedOffline ? 'border-amber-500/20' : 'border-emerald-500/20'
          }`}>
            <div>
              <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase mb-1.5 flex items-center gap-1.5 border-b border-slate-950 pb-1.5">
                {isSimulatedOffline
                  ? '📴 Betaal AI (Offline Local Knowledge)'
                  : '🤖 Betaal AI (Cohere AI — Live)'}
              </h3>
              <div className={`text-[9px] font-mono mb-2 flex items-center gap-1 ${
                isSimulatedOffline ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSimulatedOffline ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                {isSimulatedOffline
                  ? 'Offline — Using local knowledge base. Conversations stored in localStorage.'
                  : 'Online — Connected to Cohere AI. Real-time accurate answers.'}
              </div>

              {/* Chat log box */}
              <div className="mt-1 bg-slate-950/60 border border-slate-900 rounded-xl p-3 h-[160px] overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                {botChatLogs.map((log, index) => (
                  <div key={index} className={`flex flex-col ${log.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-mono text-slate-600 uppercase mb-0.5">
                      {log.sender === 'user' ? 'You' : 'Betaal AI'}
                    </span>
                    <div className={`text-[10px] px-2.5 py-1.5 rounded-xl max-w-[90%] leading-relaxed whitespace-pre-wrap ${
                      log.sender === 'user' 
                        ? 'bg-indigo-600/20 border border-indigo-500/20 text-indigo-300' 
                        : isSimulatedOffline
                          ? 'bg-amber-950/30 border border-amber-500/15 text-slate-300'
                          : 'bg-emerald-950/20 border border-emerald-500/15 text-slate-300'
                    }`}>
                      {log.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading indicator */}
              {tfjsStatus === 'loading' && (
                <div className="mt-2 bg-slate-950 border border-slate-900 rounded-lg p-2">
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                    <span>{isSimulatedOffline ? 'Processing locally...' : 'Querying Cohere AI...'}</span>
                    <span>{tfjsProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${isSimulatedOffline ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${tfjsProgress}%` }} />
                  </div>
                </div>
              )}

              {tfjsStatus === 'ready' && (
                <div className={`mt-2 text-[9px] font-mono flex items-center gap-1 ${
                  isSimulatedOffline ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSimulatedOffline ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span>{isSimulatedOffline ? 'Local knowledge base active — answers cached in localStorage' : 'Cohere AI connected — getting real-time answers'}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-950 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask Betaal about service workers, sync..."
                value={botQuery}
                onChange={(e) => setBotQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQueryLocalBot();
                }}
                className="flex-1 bg-slate-950 border border-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 font-mono"
              />
              <button
                onClick={handleQueryLocalBot}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
