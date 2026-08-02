import React, { useState, useEffect } from 'react';
import { deriveKey, hashPasscode, encryptData, decryptData } from './utils/crypto';
import { UserStreakState, Activity, Course, Badge, ActivityType, ActivityLog } from './types';
import { LIST_BADGES, BadgeCard } from './components/BadgeCard';
import { StreakCalendarHeatmap } from './components/StreakCalendarHeatmap';
import { StreakCountUp } from './components/StreakCountUp';
import { LinkedInShareCard } from './components/LinkedInShareCard';
import { TimeTravelPanel } from './components/TimeTravelPanel';
import { AccountabilityNudge } from './components/AccountabilityNudge';
import { SynergyPanel } from './components/SynergyPanel';
import { ConfettiEffect } from './components/ConfettiEffect';
import { BetaalRiddlesPanel } from './components/BetaalRiddlesPanel';
import { VikramBetaalQuestAstrolabe } from './components/VikramBetaalQuestAstrolabe';
import { TemporalLogTimeline } from './components/TemporalLogTimeline';
import { StoryLandingOverlay } from './components/StoryLandingOverlay';
import { RealmsOfPact } from './components/RealmsOfPact';
import { HallOfRecords } from './components/HallOfRecords';
import { KarmicRewards } from './components/KarmicRewards';
import { MilestoneCelebration } from './components/MilestoneCelebration';
import { CinematicHeader } from './components/CinematicHeader';
import { OfflineAccessibilityLayer } from './components/OfflineAccessibilityLayer';
import { generateMonthlyPDF } from './utils/pdfGenerator';
import { AstroKarmicDuelBoard } from './components/AstroKarmicDuelBoard';
import { MythologicalForest } from './components/MythologicalForest';
import { ThreeForestWeb3Bg } from './components/ThreeForestWeb3Bg';
import { SovereignVowAltar } from './components/SovereignVowAltar';
import { audioSynthesizer } from './utils/audioSynthesizer';
// @ts-ignore
import mythologyBg from './assets/images/vikram_betaal_mythology_1783570410289.jpg';
import { 
  Flame, 
  Award, 
  Compass, 
  HelpCircle, 
  TrendingUp, 
  Clock, 
  User, 
  Play, 
  CheckCircle, 
  Sparkles, 
  History, 
  BookOpen, 
  AlertCircle,
  LogOut,
  Info,
  FileDown,
  Volume2,
  VolumeX,
  Bell,
  Pin,
  Megaphone,
  Video,
  Scroll
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Date utility helpers
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00'); // Midday to prevent timezone shifts
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T12:00:00');
  const d2 = new Date(dateStr2 + 'T12:00:00');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Initial default state
const getRealTodayDate = (): string => {
  const local = new Date();
  const offset = local.getTimezoneOffset();
  const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
  return adjusted.toISOString().split('T')[0];
};

const INITIAL_DATE = getRealTodayDate();

const getRelativeDateStr = (daysOffset: number): string => {
  const d = new Date(getRealTodayDate() + 'T12:00:00');
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

const DEFAULT_STATE: UserStreakState = {
  currentStreak: 2, // Start at 2 so completing one activity unlocks the first milestone (3 days)
  longestStreak: 5,
  lastActiveDate: getRelativeDateStr(-1), // Active yesterday relative to INITIAL_DATE
  karmaPoints: 120,
  unlockedBadges: [], // Will auto-verify on load
  systemDate: INITIAL_DATE,
  activitiesLoggedToday: [],
  unlockedFlairs: ['neophyte'],
  activeFlair: 'neophyte',
  streakFreezes: 1,
  riddleDifficulty: 'siddha',
  soundEnabled: false,
  logs: [
    {
      date: getRelativeDateStr(-2),
      activityId: 'init-1',
      activityName: 'Watched Video Segment: Intro to Betaal\'s Riddles',
      activityType: 'video',
      timestamp: '14:30'
    },
    {
      date: getRelativeDateStr(-1),
      activityId: 'init-2',
      activityName: 'Submitted Quiz Attempt: King Vikram\'s Vow',
      activityType: 'quiz',
      timestamp: '19:45'
    }
  ]
};

// ViBe Official student portal link — opens within an iframe or as direct link
const VIBE_STUDENT_PORTAL = "https://vibe.vicharanashala.ai/student";

const COURSE_VIDEOS: Record<string, { title: string; embedUrl: string; description: string; portalUrl: string }> = {
  "vibe-github-tutorial": {
    title: "Git & GitHub — ViBe Official Tutorial",
    embedUrl: "", // Portal-only content
    portalUrl: `${VIBE_STUDENT_PORTAL}`,
    description: "Access the official ViBe Git & GitHub curriculum — version control, SSH keys, branches, pull requests, and collaborative workflows."
  },
  "vibe-typescript": {
    title: "TypeScript — ViBe Official Course",
    embedUrl: "",
    portalUrl: `${VIBE_STUDENT_PORTAL}`,
    description: "Access the official ViBe TypeScript lessons — compiler configs, primitive/object types, interface schemas, generics, and decorators."
  },
  "vibe-react": {
    title: "React JS — ViBe Official Course",
    embedUrl: "",
    portalUrl: `${VIBE_STUDENT_PORTAL}`,
    description: "Access the official ViBe React curriculum — components, hooks, state management, and production-grade application architecture."
  },
  "vibe-express": {
    title: "Express JS — ViBe Official Course",
    embedUrl: "",
    portalUrl: `${VIBE_STUDENT_PORTAL}`,
    description: "Access the official ViBe Express backend lessons — REST APIs, middleware, authentication, and database integration."
  },
  "vibe-mongo-db": {
    title: "MongoDB — ViBe Official Course",
    embedUrl: "",
    portalUrl: `${VIBE_STUDENT_PORTAL}`,
    description: "Access the official ViBe MongoDB modules — document modeling, aggregation pipelines, and schema design patterns."
  }
};

const REAL_COURSES = [
  {
    id: "vibe-github-tutorial",
    name: "GitHub Version Control",
    instructor: "ViBe Core Architect",
    category: "Github Tutorial",
    description: "Master the base protocols of modern version control. Establish secure SSH keys, manage branching systems, and collaborate with team members seamlessly.",
    lessons: [
      "Github Tutorial 1.md",
      "Github Tutorial 2.md",
      "Github Tutorial 3.md",
      "Github Tutorial 4.md",
      "Github Tutorial 5.md"
    ]
  },
  {
    id: "vibe-typescript",
    name: "TypeScript Core Foundations",
    instructor: "ViBe Core Architect",
    category: "Typescript",
    description: "Deep dive into static typing, user-defined types, decorators, advanced classes, IoC dependency injection containers, and modern software design patterns.",
    lessons: [
      "1. Introduction to TypeScript/1.1 Introduction to Typescript.md",
      "2. Basic Syntax/2.1 Basic Syntax in Typescript.md",
      "3. Variables in TypeScript/3.1 Variables in Typescript.md",
      "4. let & const/4.1 let & const.md",
      "5. Any type in TypeScript/5.1 Any type in Typescript.md",
      "6. Built-in Types/6.1 Built in Types in Typescript.md",
      "7. User Defined Types/7.1 User defined Types in Typescript.md",
      "8. Null vs Undefined/8.1 Null vs Undefined.md",
      "9. Classes & Access Modifiers.md",
      "9. Type Aliases/Type Aliases.md",
      "10. Conditional Logics/Conditional Logic in TypeScript.md",
      "10. Generics.md",
      "11. Advanced Types.md",
      "11. Mastering Loops/Mastering Loops in TypeScript.md",
      "12. Decorators.md",
      "12. Mastering Functions/Mastering Functions in TypeScript.md",
      "13. Design Patterns.md",
      "13. Optional and Default Parameters/Optional and Default Parameters in TypeScript.md",
      "14. Dependency Injection.md",
      "15. IoC Containers & Advanced Dependency Management.md"
    ]
  },
  {
    id: "vibe-react",
    name: "React & TSX Development",
    instructor: "ViBe Core Architect",
    category: "React",
    description: "Build performant client-side single page applications. Master advanced state management with Zustand, lazy loading, React memoization, and bundle optimization.",
    lessons: [
      "State Management in React.md",
      "Advanced State Management with Zustand.md",
      "Zustand Slices and Modular State Architecture.md",
      "TSX & Typed Components_.md",
      "TSX & Typed Components_Type  Safety.md",
      "Routing.md",
      "Lazy Loading.md",
      "Memoization.md",
      "Bundle Analysis.md",
      "Testing & Debugging React Apps with TypeScript.md"
    ]
  },
  {
    id: "vibe-express",
    name: "Express Scalable API Backends",
    instructor: "ViBe Core Architect",
    category: "Express",
    description: "Build highly scalable RESTful API backends. Master MVC project architectures, middleware pipeline filters, body validations, and clean repository design patterns.",
    lessons: [
      "1. Getting Started with Express.md",
      "2. Organizing Your Express Project for scalability.md",
      "3. HTTP Methods & Status Codes.md",
      "4. Request_Response.md",
      "5. Routing Controllers.md",
      "6. Middleware.md",
      "7. Request Validation.md",
      "8. MVC Pattern.md",
      "9. Repository Pattern.md",
      "10. Dependency Injection.md"
    ]
  },
  {
    id: "vibe-mongo-db",
    name: "MongoDB & Schema Modeling",
    instructor: "ViBe Core Architect",
    category: "Mongo DB",
    description: "Master document database modeling. Structure CRUD operation queries, harness the powerful Aggregation framework pipeline, and write multi-document ACID transactions.",
    lessons: [
      "CRUD Operations.md",
      "Aggregation Framework.md",
      "Transactions.md"
    ]
  }
];

// Clean lesson display names dynamically stripping nested directory prefixes and extensions
function formatLessonName(les: string): string {
  return les.substring(les.lastIndexOf('/') + 1)
    .replace('.md', '')
    .replace(/^\d+(\.\d+)?\s*/, '')
    .trim();
}

// Lightweight markdown parser for pristine thematic rendering of syllabus content
function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Headers
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-xs font-serif font-bold text-amber-300 mt-4 mb-2 tracking-wide border-b border-amber-500/10 pb-1">
          {line.substring(4)}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-sm font-serif font-bold text-amber-400 mt-5 mb-2.5 tracking-wide border-b border-amber-500/20 pb-1">
          {line.substring(3)}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={idx} className="text-base font-serif font-bold text-slate-100 mt-6 mb-3 tracking-widest uppercase pb-1 border-b border-indigo-500/30">
          {line.substring(2)}
        </h2>
      );
    }
    
    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={idx} className="text-[11px] text-slate-300 leading-relaxed list-disc ml-5 my-1 font-sans">
          {parseInlineFormatting(line.substring(2))}
        </li>
      );
    }
    
    // Code blocks markers
    if (line.trim().startsWith('```')) {
      return null;
    }
    
    // Paragraph or normal text
    if (line.trim() === '') return <div key={idx} className="h-2" />;
    
    return (
      <p key={idx} className="text-[11px] text-slate-300 leading-relaxed my-1.5 font-sans">
        {parseInlineFormatting(line)}
      </p>
    );
  });
}

function parseInlineFormatting(text: string): React.ReactNode {
  const boldRegex = /\*\*(.*?)\*\*/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <strong className="text-indigo-300 font-semibold" key={match.index}>
        {match[1]}
      </strong>
    );
    lastIndex = boldRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

import { StudentProfileManager } from './components/StudentProfileManager';
import { StudentLoginPage } from './components/StudentLoginPage';

export default function MythologyExperience() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const [state, setState] = useState<UserStreakState>(DEFAULT_STATE);

  const handleLogin = (
    username: string, 
    details: { department: string; track: string; avatar: string }, 
    passcode: string,
    forceReset: boolean = false
  ): { success: boolean; error?: string } => {
    try {
      const key = deriveKey(passcode);
      const hash = hashPasscode(passcode);

      let allProfiles: Record<string, any> = {};
      try {
        allProfiles = JSON.parse(localStorage.getItem('vibe_profiles') || '{}');
      } catch {
        allProfiles = {};
      }

      let userEntry = allProfiles[username];
      let userState;

      if (!userEntry || forceReset) {
        userState = {
          ...DEFAULT_STATE,
          department: details.department,
          track: details.track,
          avatar: details.avatar,
        };
        allProfiles[username] = {
          passcodeHash: hash,
          encryptedState: encryptData(userState, key)
        };
      } else {
        if (!userEntry.passcodeHash) {
          userState = {
            ...DEFAULT_STATE,
            ...userEntry,
            department: details.department || userEntry.department,
            track: details.track || userEntry.track,
            avatar: details.avatar || userEntry.avatar,
          };
          allProfiles[username] = {
            passcodeHash: hash,
            encryptedState: encryptData(userState, key)
          };
        } else {
          if (userEntry.passcodeHash !== hash) {
            return { 
              success: false, 
              error: "Incorrect passcode for existing profile." 
            };
          }
          try {
            userState = decryptData(userEntry.encryptedState, key);
          } catch {
            userState = null;
          }
          if (!userState) {
            userState = {
              ...DEFAULT_STATE,
              department: details.department,
              track: details.track,
              avatar: details.avatar,
            };
          }
          userState = {
            ...userState,
            department: details.department || userState.department,
            track: details.track || userState.track,
            avatar: details.avatar || userState.avatar,
          };
          allProfiles[username].encryptedState = encryptData(userState, key);
        }
      }

      localStorage.setItem('vibe_profiles', JSON.stringify(allProfiles));
      
      setSessionKey(key);
      setState(userState);
      setCurrentUser(username);

      // Play soft chime
      audioSynthesizer.playMilestoneChime();
      triggerNotification(`Welcome, ${username}! Let the streak begin.`, 'info');

      // Post to global leaderboard
      const token = localStorage.getItem('vibe_auth_token') || 'temp_token';
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: username,
          title: userState.currentStreak >= 15 ? "Vow Master Seeker" : "Novice Chronicle Seeker",
          streak: Math.max(userState.currentStreak, userState.longestStreak),
          karma: userState.karmaPoints,
          avatarSeed: details.avatar || "🎓",
          status: userState.currentStreak > 0 ? "active" : "dormant"
        })
      }).catch(err => console.warn("Failed to update global leaderboard", err));

      return { success: true };
    } catch (e: any) {
      console.error("Login error:", e);
      return { success: false, error: e.message || "Failed to initialize secure session." };
    }
  };

  const handleSwitchUser = (username: string) => {
    // If they want to switch user, we just logout so they go to the login page and enter passcode
    handleLogout();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSessionKey(null);
    setState(DEFAULT_STATE);
  };

  const [activeShareBadge, setActiveShareBadge] = useState<Badge | null>(null);
  const [activeMilestoneBadge, setActiveMilestoneBadge] = useState<Badge | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [showNotification, setShowNotification] = useState<{message: string, type: 'success' | 'info' | 'badge'} | null>(null);
  
  const triggerNotification = (message: string, type: 'success' | 'info' | 'badge') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 6000);
  };
  
  // Real Vibe learning states
  const [selectedCourseId, setSelectedCourseId] = useState<string>('vibe-github-tutorial');
  const [selectedLesson, setSelectedLesson] = useState<string>('Github Tutorial 1.md');
  const [activeRiddle, setActiveRiddle] = useState<any | null>(null);
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState<boolean>(false);
  const [isGeneratingRiddle, setIsGeneratingRiddle] = useState<boolean>(false);
  const [showScrollChamber, setShowScrollChamber] = useState<boolean>(false);
  const [activeScrollTab, setActiveScrollTab] = useState<'scroll' | 'video'>('scroll');
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(!navigator.onLine);
  
  // Track actual device Wi-Fi / network state
  useEffect(() => {
    const handleOnline = () => setIsSimulatedOffline(false);
    const handleOffline = () => setIsSimulatedOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState<boolean>(false);

  // Dynamic Video Configurations State to allow persistent real YouTube links
  const [videoConfigurations, setVideoConfigurations] = useState<Record<string, { title: string; embedUrl: string; description: string }>>(() => {
    const saved = localStorage.getItem('vibe_video_configurations');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved video configurations', e);
      }
    }
    return COURSE_VIDEOS;
  });

  const [isEditingVideoConfig, setIsEditingVideoConfig] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editUrl, setEditUrl] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');

  function getCleanEmbedUrl(url: string): string {
    if (!url) return "";
    if (url.includes('embed/')) return url;
    
    try {
      let videoId = "";
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0] || "";
      } else if (url.includes('watch?v=')) {
        videoId = url.split('watch?v=')[1]?.split('&')[0]?.split(/[?#]/)[0] || "";
      } else if (url.includes('youtube.com/v/')) {
        videoId = url.split('/v/')[1]?.split(/[?#]/)[0] || "";
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch (e) {
      console.error("Error parsing YouTube URL", e);
    }
    return url;
  }

  // Fetch announcements on load
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setIsLoadingAnnouncements(true);
      try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      } finally {
        setIsLoadingAnnouncements(false);
      }
    };
    fetchAnnouncements();
  }, []);

  // Real-world dynamic calendar auto-sync
  useEffect(() => {
    const realToday = getRealTodayDate();
    const savedDate = state.systemDate;

    if (savedDate && savedDate !== realToday) {
      if (realToday > savedDate) {
        const daysDiff = getDaysDifference(savedDate, realToday);
        if (daysDiff > 0) {
          setState(prev => {
            let currentFreezes = prev.streakFreezes || 0;
            let runningStreak = prev.currentStreak;
            let updatedLogs = [...prev.logs];

            for (let i = 1; i <= daysDiff; i++) {
              const checkDate = addDays(savedDate, i - 1);
              // Check if they completed any study activity on that date
              const hasLogged = updatedLogs.some(l => l.date === checkDate) || (checkDate === prev.systemDate && prev.activitiesLoggedToday.length > 0);

              if (!hasLogged) {
                if (currentFreezes > 0) {
                  currentFreezes -= 1;
                  updatedLogs.push({
                    date: checkDate,
                    activityId: `auto-freeze-${checkDate}`,
                    activityName: "Sanjeevani Stone Auto-Shield (Saved Consistency)",
                    activityType: "spaced-rep",
                    timestamp: "23:59"
                  });
                  // Streak remains unchanged
                } else {
                  runningStreak = 0; // Broken streak!
                }
              }
            }

            return {
              ...prev,
              systemDate: realToday,
              currentStreak: runningStreak,
              streakFreezes: currentFreezes,
              logs: updatedLogs,
              activitiesLoggedToday: [] // Reset active logged actions for today
            };
          });

          triggerNotification(`⏳ Synchronized to Today's Clock (${realToday})! Streak validated.`, 'info');
        }
      } else if (realToday < savedDate) {
        // If systemDate was in the future due to time travel simulation, synchronize it back to today safely
        setState(prev => ({
          ...prev,
          systemDate: realToday
        }));
        triggerNotification(`⏳ Aligned system date back to today: ${realToday}`, 'info');
      }
    }
  }, []);

  const [showStoryOverlay, setShowStoryOverlay] = useState<boolean>(true);

  const handleCompleteStory = () => {
    setShowStoryOverlay(false);
    localStorage.setItem('vibe_story_completed', 'true');
    triggerNotification('🔮 Portal fully unlocked. Welcome to Vikram-Betaal Chronicles!', 'success');
  };

  // Sync state to local storage securely
  useEffect(() => {
    if (currentUser && sessionKey) {
      try {
        const allProfiles = JSON.parse(localStorage.getItem('vibe_profiles') || '{}');
        
        // Preserve passcodeHash and just update encryptedState
        if (allProfiles[currentUser]) {
          allProfiles[currentUser].encryptedState = encryptData(state, sessionKey);
          localStorage.setItem('vibe_profiles', JSON.stringify(allProfiles));
        }
      } catch (e) {
        console.error('Failed to save securely encrypted profile state', e);
      }
    } else if (!currentUser) {
      localStorage.setItem('vibe_streak_state', JSON.stringify(state));
    }
  }, [state, currentUser, sessionKey]);

  // Handle autoplay constraints for mythological soundscapes
  useEffect(() => {
    if (state.soundEnabled) {
      const startOnInteraction = () => {
        audioSynthesizer.setEnabled(true);
        // Remove event listeners once activated
        window.removeEventListener('click', startOnInteraction);
        window.removeEventListener('keydown', startOnInteraction);
      };

      window.addEventListener('click', startOnInteraction);
      window.addEventListener('keydown', startOnInteraction);

      // Attempt immediate load (if browser has already allowed it from previous actions)
      audioSynthesizer.setEnabled(true);

      return () => {
        window.removeEventListener('click', startOnInteraction);
        window.removeEventListener('keydown', startOnInteraction);
      };
    } else {
      audioSynthesizer.setEnabled(false);
    }
  }, [state.soundEnabled]);

  // Check for badge unlocks dynamically based on streak
  useEffect(() => {
    const newlyUnlocked: string[] = [];
    LIST_BADGES.forEach(badge => {
      if (state.currentStreak >= badge.daysRequired && !state.unlockedBadges.includes(badge.id)) {
        newlyUnlocked.push(badge.id);
      }
    });

    if (newlyUnlocked.length > 0) {
      setState(prev => ({
        ...prev,
        unlockedBadges: [...prev.unlockedBadges, ...newlyUnlocked],
        karmaPoints: prev.karmaPoints + (newlyUnlocked.length * 50) // Bonus Karma Points for unlocking badges!
      }));

      // Trigger Confetti and Announcement
      setConfettiTrigger(true);
      const newlyUnlockedBadges = LIST_BADGES.filter(b => newlyUnlocked.includes(b.id));
      const unlockedBadgeNames = newlyUnlockedBadges.map(b => b.name).join(', ');
      
      triggerNotification(`🏆 Congratulations, Seeker! You unlocked the legendary badge(s): ${unlockedBadgeNames}! Granted +${newlyUnlocked.length * 50} Karma Points.`, 'badge');
      
      if (newlyUnlockedBadges.length > 0) {
        setActiveMilestoneBadge(newlyUnlockedBadges[newlyUnlockedBadges.length - 1]);
        audioSynthesizer.playBadgeUnlockChime();
      }

      setTimeout(() => setConfettiTrigger(false), 5000);
    }
  }, [state.currentStreak]);

  // Main Activity Logging Engine
  const handleLogActivity = (activityId: string, activityName: string, type: ActivityType, points: number) => {
    const today = state.systemDate;
    const isAlreadyLoggedToday = state.activitiesLoggedToday.includes(activityId);

    // If already logged this exact action today, let's still reward points but don't double count streak
    if (isAlreadyLoggedToday) {
      setState(prev => {
        const hasLoggedTodayType = prev.activitiesLoggedToday.length > 0;
        return {
          ...prev,
          karmaPoints: prev.karmaPoints + points,
          logs: [
            {
              date: today,
              activityId: `${activityId}-${Date.now()}`,
              activityName: `${activityName} (Extra Review)`,
              activityType: type,
              timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            },
            ...prev.logs
          ]
        };
      });
      triggerNotification(`Logged extra activity! Earned +${points} Karma Points. Streak is already secure for today.`, 'success');
      audioSynthesizer.playMilestoneChime();
      return;
    }

    setState(prev => {
      let newStreak = prev.currentStreak;
      const lastActive = prev.lastActiveDate;

      if (prev.activitiesLoggedToday.length === 0) {
        // First activity of the simulated day! Check streak consecutive status
        if (lastActive === null) {
          // Absolute first activity
          newStreak = 1;
        } else {
          const daysGap = getDaysDifference(lastActive, today);
          if (daysGap === 1) {
            // Consecutive day! Increment
            newStreak = prev.currentStreak + 1;
          } else if (daysGap === 0) {
            // Already active today, streak doesn't change
            newStreak = prev.currentStreak;
          } else {
            // Gap > 1: Streak was broken! Reset to 1
            newStreak = 1;
          }
        }
      }

      const updatedLongest = Math.max(prev.longestStreak, newStreak);
      const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      const newLog: ActivityLog = {
        date: today,
        activityId,
        activityName,
        activityType: type,
        timestamp: timeNow
      };

      return {
        ...prev,
        currentStreak: newStreak,
        longestStreak: updatedLongest,
        lastActiveDate: today,
        karmaPoints: prev.karmaPoints + points,
        activitiesLoggedToday: [...prev.activitiesLoggedToday, activityId],
        logs: [newLog, ...prev.logs]
      };
    });

    triggerNotification(`Activity logged! "${activityName}" completed. Earned +${points} Karma Points.`, 'success');
    audioSynthesizer.playMilestoneChime();
  };

  // Fast-forward 1 Day
  const handleFastForwardDay = () => {
    const nextDate = addDays(state.systemDate, 1);
    const loggedAnythingToday = state.activitiesLoggedToday.length > 0;
    const hasFreeze = (state.streakFreezes || 0) > 0;
    
    setState(prev => {
      // At the moment of ending the day, check if any activity was logged
      const logged = prev.activitiesLoggedToday.length > 0;
      let newStreak = prev.currentStreak;
      let currentFreezes = prev.streakFreezes || 0;
      const updatedLogs = [...prev.logs];

      if (!logged) {
        if (currentFreezes > 0) {
          currentFreezes -= 1;
          // Streak stays unchanged, freeze active!
          updatedLogs.push({
            date: prev.systemDate,
            activityId: `freeze-active-${prev.systemDate}`,
            activityName: "Sanjeevani Stone Activated (Streak Protected)",
            activityType: "spaced-rep",
            timestamp: "23:59"
          });
        } else {
          // Student went the whole day without completing anything! Streak resets to 0
          newStreak = 0;
        }
      }

      return {
        ...prev,
        systemDate: nextDate,
        currentStreak: newStreak,
        streakFreezes: currentFreezes,
        logs: updatedLogs,
        activitiesLoggedToday: [] // Reset active activities for the new calendar day
      };
    });

    // Notify user of date shift with custom Streak Shield messages
    if (loggedAnythingToday) {
      triggerNotification(`🌅 Sunrise! Clock advanced to ${nextDate}. A new learning day begins. Your streak is safe!`, 'info');
    } else if (hasFreeze) {
      triggerNotification(`❄️ Sanjeevani Stone Activated! Advanced to ${nextDate}. Your consecutive day streak was preserved by the protective relic! (-1 Streak Freeze Token)`, 'success');
    } else {
      triggerNotification(`💔 Sunrise! Clock advanced to ${nextDate}. Since you missed yesterday, your streak decayed to 0.`, 'info');
    }
  };

  // Skip multiple days (forces streak break)
  const handleSkipDays = (days: number) => {
    const nextDate = addDays(state.systemDate, days);
    
    setState(prev => ({
      ...prev,
      systemDate: nextDate,
      currentStreak: 0, // Reset immediately due to multiple days absence
      activitiesLoggedToday: []
    }));

    triggerNotification(`⚠️ Time-travelled ${days} days ahead to ${nextDate}. Your streak is broken due to absence!`, 'info');
  };

  // Teleport to any day (for testing high milestone badges easily)
  const handleTeleportToDay = (targetDays: number) => {
    // We want to simulate having logged every day consecutively up to targetDays
    const initialStart = new Date(INITIAL_DATE + 'T12:00:00');
    initialStart.setDate(initialStart.getDate() + targetDays - 1);
    const newSystemDate = initialStart.toISOString().split('T')[0];
    
    const simulatedLogs: ActivityLog[] = [];
    for (let i = 0; i < targetDays; i++) {
      const logDate = addDays(INITIAL_DATE, i);
      simulatedLogs.push({
        date: logDate,
        activityId: `sim-teleport-${i}`,
        activityName: i % 2 === 0 ? 'Reviewed Concept via Spaced Repetition' : 'Attempted Course Practice Quiz',
        activityType: i % 2 === 0 ? 'spaced-rep' : 'quiz',
        timestamp: '11:00'
      });
    }

    const newlyUnlockedBadges: string[] = [];
    LIST_BADGES.forEach(b => {
      if (targetDays >= b.daysRequired) {
        newlyUnlockedBadges.push(b.id);
      }
    });

    setState(prev => ({
      ...prev,
      currentStreak: targetDays,
      longestStreak: Math.max(prev.longestStreak, targetDays),
      lastActiveDate: newSystemDate,
      systemDate: newSystemDate,
      activitiesLoggedToday: ['sim-teleport-today'], // mark today as logged
      unlockedBadges: newlyUnlockedBadges,
      karmaPoints: prev.karmaPoints + (targetDays * 5) + (newlyUnlockedBadges.length * 50),
      logs: [...simulatedLogs.reverse(), ...prev.logs.filter(l => !l.activityId.startsWith('sim-teleport-'))]
    }));

    setConfettiTrigger(true);
    triggerNotification(`⚡ Teleported successfully to Streak Day ${targetDays}! Simulating historical logs & unlocking all eligible badges.`, 'badge');
    setTimeout(() => setConfettiTrigger(false), 4000);
  };

  // Reset all to defaults
  const handleResetSimulator = () => {
    setState(DEFAULT_STATE);
    localStorage.removeItem('vibe_streak_state');
    triggerNotification('🔄 Simulator reset to initial Day 1 state.', 'info');
  };

  if (!currentUser) {
    return <StudentLoginPage onLogin={handleLogin} />;
  }

  return (
    <div 
      className="min-h-screen bg-[#070514] text-slate-100 font-sans selection:bg-indigo-500/30 pb-16 relative overflow-x-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(13, 11, 35, 0.82), rgba(7, 5, 20, 0.90), rgba(4, 15, 22, 0.92)), url("${mythologyBg}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Real-time interactive 3D Web3 and Three.js Forest Canopy Background */}
      <ThreeForestWeb3Bg soundEnabled={state.soundEnabled} />

      {/* Immersive Starry Forest Theme Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Sky Stars */}
        <div className="absolute top-10 left-[12%] w-1 h-1 bg-yellow-200 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-20 left-[35%] w-1.5 h-1.5 bg-indigo-300 rounded-full animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-44 left-[65%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: '1.5s' }} />
        <div className="absolute top-12 left-[82%] w-1.5 h-1.5 bg-yellow-100 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-64 left-[15%] w-1 h-1 bg-blue-200 rounded-full animate-ping" style={{ animationDuration: '5s' }} />
        <div className="absolute top-80 left-[88%] w-1 h-1 bg-teal-200 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }} />
        
        {/* Soft forest glow nebula */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-950/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-950/25 rounded-full blur-[120px] pointer-events-none" />

        {/* Cute Floating Forest Ghosts */}
        <div className="absolute top-[280px] left-[4%] opacity-25 select-none animate-bounce" style={{ animationDuration: '6s' }}>
          <svg className="w-10 h-10 text-emerald-300" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 15C32 15 20 28 20 45C20 54 22 62 25 70C26 73 24 77 21 80C25 80 29 78 32 75C37 77 43 78 50 78C68 78 80 65 80 45C80 28 68 15 50 15ZM38 42C35 42 33 40 33 37C33 34 35 32 38 32C41 32 43 34 43 37C43 40 41 42 38 42ZM62 42C59 42 57 40 57 37C57 34 59 32 62 32C65 32 67 34 67 37C67 40 65 42 62 42Z" />
          </svg>
          <span className="text-[8px] font-mono text-emerald-400/70 block text-center">boo!</span>
        </div>

        <div className="absolute top-[650px] right-[4%] opacity-20 select-none animate-bounce" style={{ animationDuration: '8s' }}>
          <svg className="w-8 h-8 text-teal-200" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 15C32 15 20 28 20 45C20 54 22 62 25 70C26 73 24 77 21 80C25 80 29 78 32 75C37 77 43 78 50 78C68 78 80 65 80 45C80 28 68 15 50 15ZM38 42C35 42 33 40 33 37C33 34 35 32 38 32C41 32 43 34 43 37C43 40 41 42 38 42ZM62 42C59 42 57 40 57 37C57 34 59 32 62 32C65 32 67 34 67 37C67 40 65 42 62 42Z" />
          </svg>
        </div>

        {/* Dark Tree Silhouettes Framing */}
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-emerald-950/20 to-transparent flex justify-between items-end opacity-20">
          <svg className="w-32 h-32 text-emerald-950" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 10 L15 80 L35 80 L20 100 L80 100 L65 80 L85 80 Z" />
          </svg>
          <svg className="w-24 h-24 text-emerald-950" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 10 L15 80 L35 80 L20 100 L80 100 L65 80 L85 80 Z" />
          </svg>
          <svg className="w-40 h-40 text-emerald-950 hidden md:block" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 10 L15 80 L35 80 L20 100 L80 100 L65 80 L85 80 Z" />
          </svg>
          <svg className="w-28 h-28 text-emerald-950" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 10 L15 80 L35 80 L20 100 L80 100 L65 80 L85 80 Z" />
          </svg>
        </div>
      </div>

      {/* Dynamic Particle Confetti */}
      <ConfettiEffect trigger={confettiTrigger} />

      {/* Dynamic Alerts HUD */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -40, x: '-50%' }}
            id="toast-notification"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-md text-xs font-mono text-indigo-300 flex items-center justify-between gap-3.5 max-w-xl w-[90%]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <p className="leading-relaxed">{showNotification.message}</p>
            </div>
            <button 
              onClick={() => setShowNotification(null)}
              className="text-slate-500 hover:text-slate-200 font-bold ml-2 p-1 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* === OFFICIAL ViBe PLATFORM BANNER === */}
        <div className="relative mb-6 rounded-2xl overflow-hidden border border-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.12)]">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-slate-950 to-purple-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(99,102,241,0.18)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(168,85,247,0.12)_0%,transparent_60%)]" />
          {/* Shimmer line top */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
          {/* Shimmer line bottom */}
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-indigo-400/20 animate-pulse pointer-events-none"
              style={{
                width: `${4 + i * 2}px`,
                height: `${4 + i * 2}px`,
                left: `${10 + i * 15}%`,
                top: `${20 + (i % 3) * 30}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2 + i * 0.5}s`
              }}
            />
          ))}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4">
            {/* Left: Institution badge */}
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                <span className="text-2xl">🏛️</span>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-indigo-400/80 font-bold">
                  VICHARANSHALA LAB · IIT ROPAR
                </p>
                <h1 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-slate-100 leading-tight">
                  ViBe Platform
                  <span className="ml-2 text-sm font-mono font-normal text-indigo-300/70">Gamification Tab</span>
                </h1>
              </div>
            </div>
            {/* Center: Title pill */}
            <div className="hidden md:flex flex-col items-center text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Feature</span>
              <span className="text-sm font-serif font-bold text-amber-400 mt-0.5">🔥 Daily Streak Badges</span>
            </div>
            {/* Right: Links & Profile */}
            <div className="flex items-center gap-2.5">
              <StudentProfileManager 
                currentUser={currentUser} 
                onSwitchUser={handleSwitchUser} 
                onLogout={handleLogout} 
              />
              <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
              <a
                href="https://vibe.vicharanashala.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-400/30 transition-all shadow-md hover:shadow-indigo-500/30 hover:scale-105 active:scale-95"
              >
                <span>🌐</span> ViBe Portal
              </a>
              <a
                href="https://vibe.vicharanashala.ai/student"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold bg-amber-600/70 hover:bg-amber-500 text-white border border-amber-400/30 transition-all shadow-md hover:shadow-amber-500/30 hover:scale-105 active:scale-95"
              >
                <span>🎓</span> Student Videos
              </a>
            </div>
          </div>
        </div>
        {/* === END BANNER === */}

        {/* Cinematic Header with Vikram & Betaal */}
        <CinematicHeader
          systemDate={state.systemDate}
          currentStreak={state.currentStreak}
          longestStreak={state.longestStreak}
          activeFlair={state.activeFlair}
          onShowStoryOverlay={() => setShowStoryOverlay(true)}
          userName={currentUser || "Guest"}
        />

        {/* Astro-Karmic Peer Duel Board */}
        <AstroKarmicDuelBoard
          state={state}
          triggerNotification={triggerNotification}
          onAdvanceDay={handleFastForwardDay}
          onOpenLessons={() => {
            const el = document.getElementById('academic-scrolls-section') || document.getElementById('syllabus-section') || document.getElementById('quest-map-section') || document.getElementById('course-navigator-section');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            } else {
              setShowScrollChamber(true);
            }
          }}
        />

        {/* Betaal's Whispering Sacred Forest Grove */}
        <MythologicalForest
          state={state}
          triggerNotification={triggerNotification}
        />

        {/* Global Statistics Panel - Sleek Obsidian Slate Cards */}
        <section id="global-stats-bar" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          
          {/* Current Streak */}
          <div className="bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div>
              <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Active Streak</span>
              <div className="text-2xl font-bold text-slate-200 mt-1 font-mono flex items-baseline gap-1.5">
                <StreakCountUp value={state.currentStreak} /> <span className="text-[11px] text-indigo-400 font-serif font-semibold">Days</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1.5 font-mono">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span>Max Record: {state.longestStreak} days</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-indigo-400">
              <Flame className="w-5 h-5 fill-current animate-pulse" />
            </div>
          </div>

          {/* Longest Streak */}
          <div className="bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div>
              <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Highest Record</span>
              <p className="text-2xl font-bold text-slate-200 mt-1 font-mono flex items-baseline gap-1.5">
                {state.longestStreak} <span className="text-[11px] text-indigo-400 font-serif font-semibold">Days</span>
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                <span>Personal epoch boundary</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Karma Points */}
          <div className="bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div>
              <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Karmic Balance</span>
              <p className="text-2xl font-bold text-slate-200 mt-1 font-mono flex items-baseline gap-1.5">
                {state.karmaPoints} <span className="text-[11px] text-indigo-400 font-serif font-semibold">KP</span>
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                <span>Accumulated study weight</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          {/* Unlocked Badges */}
          <div className="bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div>
              <span className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Gilded Milestones</span>
              <p className="text-2xl font-bold text-slate-200 mt-1 font-mono flex items-baseline gap-1.5">
                {state.unlockedBadges.length} <span className="text-[11px] text-indigo-400 font-serif font-semibold">Unlocked</span>
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                <span>{6 - state.unlockedBadges.length} ancient secrets left</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-indigo-400">
              <Compass className="w-5 h-5" />
            </div>
          </div>

          {/* Download Monthly PDF Card */}
          <button 
            id="download-monthly-ledger"
            onClick={() => {
              try {
                generateMonthlyPDF(state);
                triggerNotification('📜 ViBe Ledger downloaded successfully!', 'success');
              } catch (err: any) {
                triggerNotification(`❌ PDF generation failed: ${err.message}`, 'success');
              }
            }}
            className="col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group text-left cursor-pointer hover:border-amber-500/40 hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)] transition-all duration-300"
          >
            <div>
              <span className="text-[9px] font-mono uppercase text-amber-500 tracking-widest font-bold">Monthly Summary</span>
              <p className="text-lg font-bold text-slate-200 mt-1 font-serif group-hover:text-amber-400 transition-colors duration-300">
                Download PDF
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                <span>ViBe Mythology Ledger</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-amber-500 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all duration-300">
              <FileDown className="w-5 h-5" />
            </div>
          </button>

          {/* Mythological Audio Portal Toggle */}
          <button 
            id="mythological-audio-toggle"
            onClick={() => {
              const nextVal = !state.soundEnabled;
              audioSynthesizer.setEnabled(nextVal);
              setState(prev => ({
                ...prev,
                soundEnabled: nextVal
              }));
              triggerNotification(
                nextVal 
                  ? '🎵 Sound Portal activated! Atmospheric soundscapes & mystical chimes enabled.' 
                  : '🔇 Sound Portal sealed. Audio silenced.',
                'info'
              );
            }}
            className={`col-span-2 lg:col-span-1 bg-gradient-to-br border rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group text-left cursor-pointer transition-all duration-300 ${
              state.soundEnabled 
                ? 'from-indigo-950/25 via-emerald-950/20 to-emerald-950/40 border-emerald-500/40 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:border-emerald-400' 
                : 'from-indigo-950/25 via-slate-900/40 to-slate-900/30 border-indigo-500/20 hover:border-amber-500/40 hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)]'
            }`}
          >
            <div>
              <span className={`text-[9px] font-mono uppercase tracking-widest font-bold transition-colors ${state.soundEnabled ? 'text-emerald-400' : 'text-slate-500 group-hover:text-amber-400'}`}>
                Sound Portal
              </span>
              <p className={`text-lg font-bold mt-1 font-serif transition-colors duration-300 ${state.soundEnabled ? 'text-emerald-400' : 'text-slate-200 group-hover:text-amber-400'}`}>
                {state.soundEnabled ? 'Audio: ON' : 'Audio: OFF'}
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                <span>{state.soundEnabled ? 'Forest Soundscape Active' : 'Temple Chimes Disabled'}</span>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
              state.soundEnabled 
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400 animate-pulse' 
                : 'bg-indigo-950/40 border-indigo-500/10 text-indigo-400 group-hover:text-amber-500 group-hover:border-amber-500/30'
            }`}>
              {state.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </div>
          </button>
        </section>

        {/* Interactive Astro-Karmic Astrolabe Quest Map */}
        <div className="mb-8">
          <VikramBetaalQuestAstrolabe 
            state={state}
            onChangeState={setState}
            onNotify={triggerNotification}
          />
        </div>

        {/* Offline Accessibility Layer */}
        <div className="mb-8">
          <OfflineAccessibilityLayer
            currentStreak={state.currentStreak}
            lastActiveDate={state.lastActiveDate}
            systemDate={state.systemDate}
            activitiesLoggedToday={state.activitiesLoggedToday}
            isSimulatedOffline={isSimulatedOffline}
            setIsSimulatedOffline={setIsSimulatedOffline}
            sessionKey={sessionKey}
            courses={REAL_COURSES}
            onLogActivity={(id, name, type, points) => handleLogActivity(id, name, type, points)}
            onSyncComplete={(syncResults) => {
              setState(prev => {
                const updatedBadges = [...prev.unlockedBadges];
                syncResults.newBadgesUnlocked.forEach(bId => {
                  if (!updatedBadges.includes(bId)) {
                    updatedBadges.push(bId);
                  }
                });

                const newLogs = [...prev.logs];
                newLogs.unshift({
                  date: syncResults.updatedLastActiveDate,
                  activityId: `pouch-sync-${Date.now()}`,
                  activityName: `Synchronized ${syncResults.newBadgesUnlocked.length > 0 ? 'Milestones' : 'Study Logs'} via PouchDB`,
                  activityType: 'spaced-rep',
                  timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                });

                return {
                  ...prev,
                  currentStreak: syncResults.updatedStreak,
                  longestStreak: Math.max(prev.longestStreak, syncResults.updatedStreak),
                  lastActiveDate: syncResults.updatedLastActiveDate,
                  karmaPoints: prev.karmaPoints + syncResults.karmaGained,
                  unlockedBadges: updatedBadges,
                  logs: newLogs
                };
              });

              if (syncResults.newBadgesUnlocked.length > 0) {
                // Trigger milestone celebration for the highest newly unlocked badge
                const allMilestones = LIST_BADGES.filter(b => syncResults.newBadgesUnlocked.includes(b.id));
                if (allMilestones.length > 0) {
                  setActiveMilestoneBadge(allMilestones[allMilestones.length - 1]);
                }
                triggerNotification(`🎉 Sync Complete! Advanced streak to ${syncResults.updatedStreak} Days & Unlocked Gilded Milestone Badges!`, 'badge');
                audioSynthesizer.playBadgeUnlockChime();
              } else {
                triggerNotification(`✨ Offline learning logs merged into Remote Server Vault! Gained +${syncResults.karmaGained} Karma Points!`, 'success');
              }
            }}
          />
        </div>

        {/* Realms of the Ancient Pact (Themed House Selector) */}
        <div className="mb-10">
          <RealmsOfPact 
            onNotify={triggerNotification}
            onAttuneRealm={(realmId) => {
              // Aligning dashboard focus state
            }}
            soundEnabled={state.soundEnabled}
          />
        </div>

        {/* Sacred Karmic Bazaar (Rewards and Customization) */}
        <div className="mb-10">
          <KarmicRewards 
            state={state}
            onChangeState={setState}
            onNotify={triggerNotification}
          />
        </div>

        {/* Dashboard Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Streak Badges Board (8 Cols on large screen) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Betaal's Story and Interactive Riddles Panel */}
            <BetaalRiddlesPanel 
              activitiesLoggedToday={state.activitiesLoggedToday}
              onLogActivity={(id, name, type, points) => handleLogActivity(id, name, type, points)}
              activeRiddle={activeRiddle}
              onClearActiveRiddle={() => setActiveRiddle(null)}
              riddleDifficulty={state.riddleDifficulty}
            />

            {/* Interactive LeetCode-style Streak Calendar and Heatmap Sanctuary */}
            <StreakCalendarHeatmap
              systemDate={state.systemDate}
              logs={state.logs}
              currentStreak={state.currentStreak}
              longestStreak={state.longestStreak}
              karmaPoints={state.karmaPoints}
              activitiesLoggedToday={state.activitiesLoggedToday}
            />
            
            {/* The Badges Grid Section */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div>
                  <h2 className="text-base font-serif font-bold text-slate-100 tracking-wider uppercase flex items-center gap-2">
                    🏆 Gilded Mythology Credentials
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Consecutive presence milestones verified by the laws of karma and study.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Ultimate Threshold: <strong className="text-indigo-400">100 Days</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {LIST_BADGES.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    unlocked={state.unlockedBadges.includes(badge.id)}
                    streakCount={state.currentStreak}
                    onShare={(b) => setActiveShareBadge(b)}
                  />
                ))}
              </div>
            </div>

            {/* Platform Synergy Section */}
            <div>
              <div className="mb-4">
                <h2 className="text-base font-serif font-bold text-slate-100 tracking-wider uppercase flex items-center gap-2">
                  🔌 Integration & Daily Study Alignment
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Submitting study metrics or revising concepts validates your learning vow.
                </p>
              </div>
              <SynergyPanel
                karmaPoints={state.karmaPoints}
                activitiesLoggedToday={state.activitiesLoggedToday}
                onLogActivity={(id, name, type, points) => handleLogActivity(id, name, type, points)}
              />
            </div>

            {/* Chronological History Log */}
            <TemporalLogTimeline
              logs={state.logs}
              systemDate={state.systemDate}
              onClearLogs={() => {
                setState((prev: any) => ({
                  ...prev,
                  logs: []
                }));
              }}
              onNotify={triggerNotification}
              onChangeState={setState}
            />

          </div>

          {/* RIGHT COLUMN: Action center & Accountability (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Sovereign Daily Vow Altar widget */}
            <SovereignVowAltar 
              state={state}
              onChangeState={setState}
              onNotify={triggerNotification}
            />
            
            {/* Sovereign Vibe Student Portal Announcements Feed */}
            <div className="bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-amber-400 animate-pulse" /> Vibe Portal Announcements
                </h3>
                <span className="text-[9px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                  <Bell className="w-2.5 h-2.5 text-indigo-400 animate-bounce" /> LIVE FEED
                </span>
              </div>

              {isLoadingAnnouncements ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-indigo-500/20 border-t-indigo-400 animate-spin" />
                  <p className="text-[10px] font-mono text-slate-500">Connecting to student portal notifications...</p>
                </div>
              ) : announcements.length > 0 ? (
                <div className="space-y-3.5 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent pr-1">
                  {announcements.map((ann) => (
                    <div 
                      key={ann.id} 
                      className={`p-3.5 rounded-xl border transition-all duration-300 relative ${
                        ann.isPinned 
                          ? 'bg-amber-950/15 border-amber-500/20 hover:border-amber-500/40 shadow-[0_2px_12px_rgba(245,158,11,0.04)]' 
                          : 'bg-indigo-950/20 border-indigo-500/5 hover:border-indigo-500/20'
                      }`}
                    >
                      {ann.isPinned && (
                        <div className="absolute top-3 right-3 text-amber-500 flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-current rotate-45" />
                          <span className="text-[8px] font-mono uppercase font-bold tracking-widest">PINNED</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                          ann.tag === 'Summership' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            : ann.tag === 'AI'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                            : ann.tag === 'MEAN Stack'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/15'
                        }`}>
                          {ann.tag}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">{ann.date}</span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-200 leading-snug">{ann.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1.5 font-sans leading-relaxed">{ann.content}</p>
                      
                      <div className="mt-2.5 pt-2 border-t border-slate-900/60 flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span>Issued by: <strong className="text-slate-300">{ann.author}</strong></span>
                        <span className="italic">Vicharana Shala</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center py-6 font-mono">No active announcements on the bulletin.</p>
              )}
            </div>

            {/* Learning Hub Activities */}
            <div className="bg-gradient-to-br from-indigo-950/15 via-slate-900/40 to-slate-900/30 backdrop-blur-md border border-indigo-500/15 rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30">
              <h3 className="text-xs font-bold text-slate-200 font-mono tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" /> Daily Learning Hub
              </h3>
              <p className="text-xs text-slate-400 mb-4 font-mono leading-relaxed">
                Study a live course scroll from the Vibe repository and summon Betaal for a live AI-generated riddle challenge to lock in your daily streak.
              </p>

              {/* Academic Track Picker */}
              <div className="mb-3">
                <label className="text-[9px] font-mono text-slate-500 uppercase block mb-1.5 tracking-wider">Academic Track</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    const newCourseId = e.target.value;
                    setSelectedCourseId(newCourseId);
                    const course = REAL_COURSES.find(c => c.id === newCourseId);
                    if (course && course.lessons.length > 0) {
                      setSelectedLesson(course.lessons[0]);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/30 transition-all cursor-pointer font-mono"
                >
                  {REAL_COURSES.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lesson Picker */}
              <div className="mb-4">
                <label className="text-[9px] font-mono text-slate-500 uppercase block mb-1.5 tracking-wider">Syllabus Scroll</label>
                <select
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/30 transition-all cursor-pointer font-mono"
                >
                  {(REAL_COURSES.find(c => c.id === selectedCourseId)?.lessons || []).map((les) => (
                    <option key={les} value={les}>
                      {formatLessonName(les)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons Grid */}
              <div className="flex flex-col gap-3">
                
                {/* 1. Read & Study Live Scroll */}
                <button
                  onClick={async () => {
                    setIsLoadingLesson(true);
                    setShowScrollChamber(true);
                    setActiveScrollTab('scroll');
                    try {
                      const course = REAL_COURSES.find(c => c.id === selectedCourseId);
                      if (!course) return;

                      const cacheKey = `/api/lesson-content?category=${encodeURIComponent(course.category)}&lesson=${encodeURIComponent(selectedLesson)}`;

                      // Real and Simulated Offline Check
                      if (isSimulatedOffline || !navigator.onLine) {
                        console.log("[Offline Mode] Querying cache key:", cacheKey);
                        const cache = await caches.open('vibe-offline-cache-v2');
                        const cachedResponse = await cache.match(cacheKey);
                        if (cachedResponse) {
                          const data = await cachedResponse.json();
                          setLessonContent(data.content + "\n\n---\n*✨ Authentically retrieved from on-device Cache Storage (Offline Mode).*");
                          setIsLoadingLesson(false);
                          return;
                        } else {
                          throw new Error("This lesson is not pre-cached on this device yet.");
                        }
                      }

                      const res = await fetch(cacheKey);
                      if (!res.ok) throw new Error("Failed to fetch lesson");
                      const data = await res.json();
                      setLessonContent(data.content);
                    } catch (err: any) {
                      console.error(err);
                      setLessonContent(`# ${formatLessonName(selectedLesson)}\n\n*Failed to retrieve raw scroll content offline: ${err.message || 'Network down'}*\n\nTo study this lesson offline, please connect to the internet, toggle **ONLINE** mode, and click **"PRE-CACHE ALL LESSONS"** in the Starry Forest PWA Sanctuary below!`);
                    } finally {
                      setIsLoadingLesson(false);
                    }
                  }}
                  id="btn-action-read-scroll"
                  className="w-full bg-gradient-to-r from-indigo-950/40 to-slate-900 hover:to-indigo-900/10 border border-indigo-500/25 hover:border-indigo-500/50 text-left p-3.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:scale-105 transition-transform">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1">Unfurl Study Scroll</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Read lesson & generate AI riddle</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Study Vow
                  </span>
                </button>

                {/* 2. Practice Standard Challenge */}
                <button
                  onClick={() => {
                    const c = REAL_COURSES.find(crs => crs.id === selectedCourseId) || REAL_COURSES[0];
                    handleLogActivity(`practice-${c.id}`, `Completed Practice Session on ${c.name}`, 'quiz', 15);
                    triggerNotification("Practice session metrics recorded successfully!", "success");
                  }}
                  id="btn-action-solve-quiz"
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 text-left p-3.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-950 text-slate-400 rounded-lg group-hover:scale-105 transition-transform">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300">Practice Revision Quiz</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Quick offline conceptual quiz</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded">
                    +15 KP
                  </span>
                </button>

                {/* 3. Doubt Forum */}
                <button
                  onClick={() => {
                    handleLogActivity('forum-post', 'Submitted Peer Forum Doubt', 'question', 10);
                    triggerNotification("Doubt submitted to peer review networks!", "success");
                  }}
                  id="btn-action-submit-question"
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 text-left p-3.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-950 text-slate-400 rounded-lg group-hover:scale-105 transition-transform">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300">Post Doubt to Forum</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Exchange pointers with developers</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded">
                    +10 KP
                  </span>
                </button>

              </div>
            </div>

            {/* Accountability Nudge section */}
            <AccountabilityNudge
              currentStreak={state.currentStreak}
              isTodayLogged={state.activitiesLoggedToday.length > 0}
              onLogQuickActivity={() => {
                handleLogActivity('nudge-quick', 'Betaal Prompt: Late Night Concept Revision', 'spaced-rep', 10);
              }}
            />

            {/* Vikram's Hall of Records Leaderboard */}
            <HallOfRecords
              currentStreak={state.currentStreak}
              longestStreak={state.longestStreak}
              karmaPoints={state.karmaPoints}
              userName={currentUser || "Guest"}
              avatar={state.avatar || "🎓"}
              activeFlair={state.activeFlair}
              logs={state.logs}
              systemDate={state.systemDate}
            />

            {/* Developers Time Travel Panel */}
            <TimeTravelPanel
              systemDate={state.systemDate}
              currentStreak={state.currentStreak}
              lastActiveDate={state.lastActiveDate}
              activitiesLoggedToday={state.activitiesLoggedToday}
              onFastForward={handleFastForwardDay}
              onSkipDays={handleSkipDays}
              onTeleportToDay={handleTeleportToDay}
              onResetAll={handleResetSimulator}
            />

          </div>

        </div>

        {/* Verifiable details informational footer card */}
        <footer className="mt-12 p-5 bg-slate-950/80 border border-slate-900 rounded-2xl max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 text-center md:text-left justify-between backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl">
              <Award className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-serif font-bold uppercase tracking-wider text-slate-200">Verifiable Learning Credentials</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed font-mono">
                By making streak milestones shareable, students carry verifiable proof of grit, consistency, and daily study discipline to external networks.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
            <span>Powered by ViBe Engine</span>
          </div>
        </footer>

      </div>

      {/* LinkedIn Share Modal Customizer Portal */}
      <AnimatePresence>
        {activeShareBadge && (
          <LinkedInShareCard
            badge={activeShareBadge}
            streakCount={state.currentStreak}
            courses={REAL_COURSES}
            userEmail="seeker@vibe.edu"
            onClose={() => setActiveShareBadge(null)}
          />
        )}
      </AnimatePresence>

      {/* The Study Scroll Chamber Modal */}
      <AnimatePresence>
        {showScrollChamber && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/20 max-w-2xl w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.08)] flex flex-col max-h-[85vh]"
            >
              {/* Scroll Header */}
              <div className="border-b border-slate-800 p-4 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-amber-400 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-serif font-bold text-slate-100 uppercase tracking-wider">
                      {REAL_COURSES.find(c => c.id === selectedCourseId)?.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatLessonName(selectedLesson)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowScrollChamber(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs font-mono bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
                >
                  CLOSE ESC
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-slate-850 bg-slate-950 p-1">
                <button
                  onClick={() => setActiveScrollTab('scroll')}
                  className={`flex-1 py-2 text-center text-xs font-mono font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    activeScrollTab === 'scroll'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Scroll className="w-3.5 h-3.5" /> Study Scroll
                </button>
                <button
                  onClick={() => setActiveScrollTab('video')}
                  className={`flex-1 py-2 text-center text-xs font-mono font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    activeScrollTab === 'video'
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-indigo-400" /> Walkthrough Video
                </button>
              </div>

              {/* Scroll Content Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-950/40 text-slate-300 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                {activeScrollTab === 'scroll' ? (
                  isLoadingLesson ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                      <p className="text-xs font-mono text-slate-500">Unfurling the Vibe knowledge scroll from GitHub...</p>
                    </div>
                  ) : lessonContent ? (
                    <div className="space-y-3 font-sans">
                      {parseMarkdown(lessonContent)}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-10 italic font-mono">Could not read scroll content.</p>
                  )
                ) : (
                  /* Dynamic Video Lecture View */
                  <div className="space-y-5">
                    {(() => {
                      const videoInfo = videoConfigurations[selectedCourseId] || COURSE_VIDEOS[selectedCourseId];
                      if (!videoInfo) {
                        return (
                          <div className="py-10 text-center text-xs font-mono text-slate-500 italic">
                            No dedicated video segment has been mapped for this domain scroll yet.
                          </div>
                        );
                      }
                      
                      const isLogged = state.activitiesLoggedToday.includes(`video-${selectedCourseId}`);
                      
                      return (
                        <div className="space-y-4">
                          <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-1">
                            <h4 className="text-xs font-serif font-bold text-slate-200 flex items-center gap-2">
                              <Video className="w-4 h-4 text-indigo-400" />
                              {videoInfo.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                              {videoInfo.description}
                            </p>
                          </div>
                          
                          {/* Dynamic Custom Video Configurator Panel */}
                          <div className="border border-indigo-500/15 rounded-xl overflow-hidden bg-slate-950/40">
                            <button
                              onClick={() => {
                                setIsEditingVideoConfig(!isEditingVideoConfig);
                                if (!isEditingVideoConfig) {
                                  setEditTitle(videoInfo.title);
                                  setEditUrl(videoInfo.embedUrl);
                                  setEditDesc(videoInfo.description);
                                }
                              }}
                              className="w-full py-2 px-4 bg-indigo-950/20 hover:bg-indigo-900/15 text-[10px] font-mono font-bold text-indigo-400 flex items-center justify-between transition-all border-b border-indigo-500/5 cursor-pointer"
                            >
                              <span>{isEditingVideoConfig ? "✕ HIDE CUSTOM VIDEO FEED GATEWAY" : "⚙️ CONFIGURE VIBE CUSTOM VIDEO URL"}</span>
                              <span className="text-[8px] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 tracking-wider">CHRONICLE GATE</span>
                            </button>
                            
                            {isEditingVideoConfig && (
                              <div className="p-4 space-y-3.5 bg-slate-950/85">
                                <div className="text-[10px] text-slate-400 font-mono leading-relaxed">
                                  Paste the real YouTube watch, embed, or short link for this VIBE course segment. It will automatically parse and persist in local storage.
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-mono text-slate-500 uppercase block tracking-wider">Video Title</label>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="e.g., Git & GitHub Advanced Walkthrough"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/30 font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-mono text-slate-500 uppercase block tracking-wider">YouTube URL</label>
                                  <input
                                    type="text"
                                    value={editUrl}
                                    onChange={(e) => setEditUrl(e.target.value)}
                                    placeholder="e.g., https://www.youtube.com/watch?v=RGOj5yH7evk"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/30 font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-mono text-slate-500 uppercase block tracking-wider">Video Description</label>
                                  <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    placeholder="Brief outline of lesson walk-through topics..."
                                    rows={2}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500/30 font-mono resize-none"
                                  />
                                </div>
                                <div className="flex justify-end pt-1">
                                  <button
                                    onClick={() => {
                                      const cleanUrl = getCleanEmbedUrl(editUrl);
                                      const updated = {
                                        ...videoConfigurations,
                                        [selectedCourseId]: {
                                          title: editTitle,
                                          embedUrl: cleanUrl,
                                          description: editDesc
                                        }
                                      };
                                      setVideoConfigurations(updated);
                                      localStorage.setItem('vibe_video_configurations', JSON.stringify(updated));
                                      setIsEditingVideoConfig(false);
                                      triggerNotification("Walkthrough video updated & synchronized!", "success");
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 text-[10px] font-mono font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-all active:scale-95 shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                                  >
                                    Save Walkthrough Configuration
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* ViBe Official Student Portal Video Gateway */}
                          <a
                            href={videoInfo.portalUrl || "https://vibe.vicharanashala.ai/student"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center justify-center w-full aspect-video bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-xl overflow-hidden border border-indigo-500/20 shadow-inner relative hover:border-indigo-400/40 transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] cursor-pointer no-underline"
                            onClick={() => {
                              if (!isLogged) {
                                handleLogActivity(
                                  `video-${selectedCourseId}`,
                                  `Watched ViBe official lecture: "${videoInfo.title}"`,
                                  'video',
                                  15
                                );
                              }
                            }}
                          >
                            {/* Radial glow */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0%,transparent_65%)] group-hover:opacity-150 transition-opacity" />
                            {/* Animated ring */}
                            <div className="absolute w-28 h-28 rounded-full border border-indigo-500/20 animate-ping opacity-20 group-hover:opacity-40" />
                            <div className="absolute w-40 h-40 rounded-full border border-purple-500/10 animate-ping opacity-10" style={{animationDuration:'2.4s'}} />
                            {/* Play icon */}
                            <div className="relative z-10 w-16 h-16 rounded-full bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-300 mb-4">
                              <Play className="w-7 h-7 text-white fill-white ml-1" />
                            </div>
                            <p className="relative z-10 text-sm font-bold font-serif text-slate-100 text-center px-4 group-hover:text-indigo-200 transition-colors">
                              {videoInfo.title}
                            </p>
                            <p className="relative z-10 text-[10px] font-mono text-slate-400 mt-1.5 text-center px-6">
                              Opens official ViBe Student Portal at vicharanashala.ai
                            </p>
                            <div className="relative z-10 mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-600/60 border border-indigo-400/30 text-[10px] font-mono text-white font-bold group-hover:bg-indigo-500/80 transition-all">
                              <span>🎓</span>
                              <span>Watch on ViBe Portal →</span>
                            </div>
                          </a>
                          
                          {/* Lecture Attendance Confirmation Button */}
                          <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-[10px] text-slate-400 font-mono max-w-sm">
                              {isLogged ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                  <CheckCircle className="w-4 h-4" /> Attendance Logged! Earned +15 KP & Secured Streak Integrity!
                                </span>
                              ) : (
                                <span>Pledge your watch attendance to record +15 KP and update the royal chronicles.</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                if (isLogged) return;
                                handleLogActivity(
                                  `video-${selectedCourseId}`,
                                  `Watched dynamic walkthrough video: "${videoInfo.title}"`,
                                  'video',
                                  15
                                );
                              }}
                              disabled={isLogged}
                              className={`w-full sm:w-auto font-mono text-[11px] font-bold py-2 px-4 rounded-lg transition-all ${
                                isLogged
                                  ? 'bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-slate-100 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] active:scale-95 cursor-pointer'
                              }`}
                            >
                              {isLogged ? "Completed ✓" : "Pledge Attendance (+15 KP)"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Scroll Footer controls */}
              <div className="border-t border-slate-800 p-4 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[10px] font-mono text-slate-400 leading-tight">
                  <span>Read thoroughly. Once finished, pledge your study vow to summon Betaal.</span>
                </div>
                <button
                  onClick={async () => {
                    if (!lessonContent) return;
                    setIsGeneratingRiddle(true);
                    try {
                      const course = REAL_COURSES.find(c => c.id === selectedCourseId);
                      const token = localStorage.getItem('vibe_auth_token') || 'temp_token';
                      const res = await fetch('/api/generate-riddle', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({
                          lessonTitle: selectedLesson,
                          category: course?.category,
                          content: lessonContent
                        })
                      });
                      if (!res.ok) throw new Error("Riddle API failed");
                      const data = await res.json();
                      setActiveRiddle(data);
                      setShowScrollChamber(false);
                      triggerNotification("Betaal has materialized with a custom riddle challenge based on your scroll!", "info");
                      
                      // Scroll to Betaal riddles panel
                      setTimeout(() => {
                        const el = document.getElementById("betaal-riddles-panel-root");
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 150);
                    } catch (err) {
                      console.error(err);
                      triggerNotification("The crematorium wind is unstable. Attempt standard practice or retry.", "success");
                    } finally {
                      setIsGeneratingRiddle(false);
                    }
                  }}
                  disabled={isGeneratingRiddle || !lessonContent}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-serif font-bold py-2.5 px-5 rounded-xl text-xs shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingRiddle ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-950/20 border-t-slate-950 animate-spin" />
                      <span>Invoking Betaal...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current animate-pulse" />
                      <span>Vow & Summon Betaal's Riddle</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vikram & Betaal Scroll-Triggered Story Prologue Overlay */}
      <AnimatePresence>
        {showStoryOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="fixed inset-0 z-[999]"
          >
            <StoryLandingOverlay onComplete={handleCompleteStory} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Milestone Celebration Overlay */}
      <AnimatePresence>
        {activeMilestoneBadge && (
          <MilestoneCelebration
            badge={activeMilestoneBadge}
            onClose={() => {
              // Grant additional +50 KP bonus for claiming the blessing
              setState(prev => ({
                ...prev,
                karmaPoints: prev.karmaPoints + 50
              }));
              setActiveMilestoneBadge(null);
              triggerNotification("✨ Received Sovereign Blessing: +50 KP Bonus added to your Karma reserves!", "success");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
