import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Compass, Volume2, VolumeX, ChevronDown, Award, Flame, BookOpen, Crown, Swords, Shield, Ghost } from 'lucide-react';

// @ts-ignore
import vikramBetaalCover from '../assets/images/vikram_betaal_cover_1783688336392.jpg';

interface StoryLandingOverlayProps {
  onComplete: () => void;
}

interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  mythos: string;
}

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: "The Sovereign's Silent Vow",
    subtitle: "CHAPTER I: THE CALL TO COGNITIVE TRIAL",
    body: "Under a dark, moonless sky in the ancient crematorium of Ujjain, King Vikram enters the shadows. Driven by an unyielding vow made to a mysterious ascetic, he seeks the gnarled banyan tree to claim Betaal.",
    mythos: "Every learning trek starts with a pledge—a commitment to step into the dark of the unknown and persist when others turn back."
  },
  {
    id: 2,
    title: "The Hanging Specter",
    subtitle: "CHAPTER II: THE WIT OF THE BETAAL",
    body: "Suspended upside down from gnarled roots is Betaal, an elusive spirit of deep cosmic wisdom and riddles. As Vikram shoulders the corpse, the spirit laughs: 'We shall walk, O King, but on one condition: I shall tell you tales of riddles. If you speak to answer, I shall fly back. If you know the truth and remain silent, your head will shatter.'",
    mythos: "The Betaal represents our hard puzzles, spacing difficulties, and the friction of memory. It demands we actively engage, yet challenges us to master silence and focus."
  },
  {
    id: 3,
    title: "The Path of Constant Vigilance",
    subtitle: "CHAPTER III: THE CONSECRATED STREAK",
    body: "With every riddle solved, Vikram is forced to carry the spirit back to the banyan tree, repeating his arduous walk again and again. The trial of focus is never a single leap; it is a relentless, repeatable sequence of daily discipline.",
    mythos: "A streak is not a mere number. It is Vikram's walk—a physical and mental manifestation of daily devotion to memory, grit, and the vows of study."
  },
  {
    id: 4,
    title: "The Laws of Karmic Attention",
    subtitle: "CHAPTER IV: SYNERGY OF MIND",
    body: "Betaal watches over our daily habits. Every flashcard reviewed, every concept wrestled, and every quiz submitted is a valid token of presence. In the eyes of the celestial laws, active effort is the only armor that preserves our active streak.",
    mythos: "By engaging in active retrieval, our daily scholastic metrics satisfy Betaal's test and shield our accumulated karma."
  },
  {
    id: 5,
    title: "Forging Your Gilded Legacy",
    subtitle: "FINAL CHAPTER: ENTER THE PORTAL",
    body: "The banyan trees parting, the mystical smoke dissolving into stardust. The ancient scrolls have been opened, ready for you to record your own journey. Maintain your walk, solve the puzzles, and carry the weight of King Vikram's lantern.",
    mythos: "Your daily learning portal is prepared. Keep the streak alight and honor the ancient vow."
  }
];

export const StoryLandingOverlay: React.FC<StoryLandingOverlayProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeChapter, setActiveChapter] = useState(0);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [curtainsOpened, setCurtainsOpened] = useState(false);

  const scrollProgressRef = useRef(0);
  const activeChapterRef = useRef(0);

  // Sound Synthesis state and refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthRef = useRef<{
    drone: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  // Three.js instances refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const relicMeshRef = useRef<THREE.Mesh | null>(null);
  const relicWireRef = useRef<THREE.LineSegments | null>(null);
  const spotLightRef = useRef<THREE.SpotLight | null>(null);

  // Initialize browser-synthesized soundtrack — Ceremonial Shankh Bell Sound
  const initAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();

      // === Ceremonial Shankh Bell Sound ===
      // Layer 1: Warm fundamental bell tone (root note A2 110Hz)
      const bell1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      bell1.type = 'sine';
      bell1.frequency.setValueAtTime(110, ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);

      // Layer 2: Harmonic overtone — pure fifth (E3 164Hz) adds richness
      const bell2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      bell2.type = 'sine';
      bell2.frequency.setValueAtTime(164.81, ctx.currentTime);
      gain2.gain.setValueAtTime(0, ctx.currentTime);

      // Layer 3: Warm octave drone (A3 220Hz) for depth
      const bell3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      bell3.type = 'triangle';
      bell3.frequency.setValueAtTime(220, ctx.currentTime);
      gain3.gain.setValueAtTime(0, ctx.currentTime);

      // Lowpass filter for warm, round bell timbre (not harsh)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, ctx.currentTime);
      filter.Q.setValueAtTime(0.8, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);

      // Connect signal chain
      bell1.connect(gain1); gain1.connect(filter);
      bell2.connect(gain2); gain2.connect(filter);
      bell3.connect(gain3); gain3.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      bell1.start(); bell2.start(); bell3.start();

      // Keep the master reference for toggling
      synthRef.current = { drone: bell1, gain: masterGain, filter };
      // Expose the partial gains for balanced volume
      (synthRef.current as any)._g1 = gain1;
      (synthRef.current as any)._g2 = gain2;
      (synthRef.current as any)._g3 = gain3;
      audioCtxRef.current = ctx;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  };

  const toggleSound = () => {
    if (!audioCtxRef.current) {
      initAudio();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (synthRef.current) {
      const masterGain = synthRef.current.gain;
      const ctx = audioCtxRef.current!;
      const now = ctx.currentTime;
      // Individually fade the three bell layers to balanced volumes
      const g1 = (synthRef.current as any)._g1 as GainNode | undefined;
      const g2 = (synthRef.current as any)._g2 as GainNode | undefined;
      const g3 = (synthRef.current as any)._g3 as GainNode | undefined;

      if (isPlayingSound) {
        // Fade out gracefully
        masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
      } else {
        // Fade in with balanced bell layers
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(1.0, now + 1.5);
        if (g1) { g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.06, now + 1.5); }
        if (g2) { g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(0.04, now + 1.5); }
        if (g3) { g3.gain.setValueAtTime(0, now); g3.gain.linearRampToValueAtTime(0.035, now + 1.5); }
      }
      setIsPlayingSound(!isPlayingSound);
    }
  };

  // Sound transition cue when chapter changes — ascending pentatonic chime
  const playChapterCue = (chapterIdx: number) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended' || !isPlayingSound) return;
    const ctx = audioCtxRef.current;
    
    // Royal ascending bell tones (Sa Re Ga Ma Pa — Raga Bhairav feel)
    const frequencies = [261.63, 293.66, 329.63, 392.0, 440.0]; // C D E G A
    const freq = frequencies[chapterIdx % frequencies.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 2.1);

    // Modulate filter cutoff beautifully on chapter transition (higher brightness per chapter)
    if (synthRef.current) {
      const targetCutoff = 800 + chapterIdx * 250;
      synthRef.current.filter.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 1.2);
    }
  };

  // Core Three.js implementation
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#020617', 0.025);
    sceneRef.current = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    // 2. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // 3. Creating Gold-Etched Relic Mesh (Central Talisman - Torus Knot Geometry)
    const relicGeo = new THREE.TorusKnotGeometry(1.4, 0.45, 120, 16, 2, 5);
    
    const relicMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Royal gold color
      roughness: 0.15,
      metalness: 0.9,
      flatShading: true,
      bumpScale: 0.1
    });
    const relicMesh = new THREE.Mesh(relicGeo, relicMat);
    scene.add(relicMesh);
    relicMeshRef.current = relicMesh;

    // Wireframe overlay to emphasize the "gold-etched" holographic ritual vibe
    const wireGeo = new THREE.WireframeGeometry(relicGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b, // Amber glow
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const relicWire = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(relicWire);
    relicWireRef.current = relicWire;

    // 4. Starfield & Cosmic Dust Particle System
    const particleCount = 2000;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      // Cylinder distribution
      const theta = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 12;
      positions[idx] = Math.cos(theta) * r;
      positions[idx + 1] = (Math.random() - 0.5) * 16;
      positions[idx + 2] = Math.sin(theta) * r;

      speeds[i] = 0.2 + Math.random() * 1.5;

      // Color mapping: transitioning from gold-etched sand to indigo mystery
      const ratio = Math.random();
      if (ratio > 0.6) {
        // Celestial Amber/Gold
        colors[idx] = 1.0;
        colors[idx + 1] = 0.75;
        colors[idx + 2] = 0.3;
      } else {
        // Deep Spectral Indigo
        colors[idx] = 0.39;
        colors[idx + 1] = 0.4;
        colors[idx + 2] = 0.95;
      }
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Circle texture generator for soft particles
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.4, 'rgba(212, 175, 55, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 16, 16);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.14,
      map: pTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);
    particleSystemRef.current = particleSystem;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight('#030712', 1.5);
    scene.add(ambientLight);

    // Focused Gold Spotlight targeting the relic
    const spotLight = new THREE.SpotLight(0xd4af37, 8, 25, Math.PI / 4, 0.5, 1);
    spotLight.position.set(0, 5, 8);
    spotLight.lookAt(0, 0, 0);
    scene.add(spotLight);
    spotLightRef.current = spotLight;

    // Ghostly blue ambient fill light
    const fillLight = new THREE.PointLight('#4f46e5', 4, 15);
    fillLight.position.set(-4, -2, 2);
    scene.add(fillLight);

    // 6. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    // Smoothed target variables for scroll animations
    let smoothProgress = 0;
    
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth interpolation (lerp) of current scroll progress
      smoothProgress += (scrollProgressRef.current - smoothProgress) * 0.08;

      // Rotate Relic based on scroll and time
      if (relicMesh && relicWire) {
        // Base rotation + scroll driven speedup
        const rotationSpeed = 0.3 + smoothProgress * 1.8;
        relicMesh.rotation.y = elapsed * 0.4 + smoothProgress * Math.PI * 2;
        relicMesh.rotation.x = elapsed * 0.2 + Math.sin(elapsed * 0.5) * 0.2;
        relicWire.rotation.copy(relicMesh.rotation);

        // Relic position shifts based on active scrolling
        relicMesh.position.y = Math.sin(elapsed * 1.5) * 0.15;
        // Float horizontal coordinate slightly towards panels on scroll
        relicMesh.position.x = Math.sin(elapsed * 0.5) * 0.1 - (smoothProgress * 0.5);
        relicWire.position.copy(relicMesh.position);

        // Relic scale morphs on final steps (blooming on portal opening)
        const targetScale = 1.0 + Math.sin(elapsed * 2.0) * 0.04 + (smoothProgress * 0.25);
        relicMesh.scale.set(targetScale, targetScale, targetScale);
        relicWire.scale.copy(relicMesh.scale);
      }

      // Camera position adapts to scroll progress to create depth transitions
      if (camera) {
        // Zooming in slightly and shifting angle as user progresses
        camera.position.z = 8 - (smoothProgress * 2.5);
        camera.position.y = Math.sin(elapsed * 0.3) * 0.2;
        camera.lookAt(0, 0, 0);
      }

      // Swirling starfield animations
      if (particleSystem) {
        const posArr = particleSystem.geometry.attributes.position.array as Float32Array;
        // Change color based on scroll (transition from mystery dark to blinding gold)
        const colorArr = particleSystem.geometry.attributes.color.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          const speed = speeds[i];

          // Swirl particles around Y axis
          const x = posArr[idx];
          const z = posArr[idx + 2];
          const angle = (0.001 + smoothProgress * 0.006) * speed;
          
          posArr[idx] = x * Math.cos(angle) - z * Math.sin(angle);
          posArr[idx + 2] = x * Math.sin(angle) + z * Math.cos(angle);

          // Drift upward/downward based on scroll progress
          posArr[idx + 1] += Math.sin(elapsed * 0.2 + i) * 0.002 * speed + (smoothProgress * 0.01 * speed);
          if (Math.abs(posArr[idx + 1]) > 12) {
            posArr[idx + 1] = -posArr[idx + 1] * 0.9;
          }

          // Dynamically increase gold ratio in final steps
          if (smoothProgress > 0.6) {
            // Morph stars to pure brilliant golden sparks
            colorArr[idx] = Math.min(1.0, colorArr[idx] + 0.02);
            colorArr[idx + 1] = Math.min(0.9, colorArr[idx + 1] + 0.02);
            colorArr[idx + 2] = Math.max(0.2, colorArr[idx + 2] - 0.02);
          }
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
      }

      // Pulse spotlight intense intensity
      if (spotLight) {
        spotLight.intensity = 8 + Math.sin(elapsed * 3.0) * 3 + (smoothProgress * 12);
      }

      // Smoothly shift 3D scene fog color dynamically depending on the active chapter
      if (scene) {
        let targetFogColor = new THREE.Color('#020617');
        if (activeChapterRef.current === 1) targetFogColor = new THREE.Color('#031f13'); // Spectral Emerald
        else if (activeChapterRef.current === 2) targetFogColor = new THREE.Color('#1f1005'); // Amber Ascent
        else if (activeChapterRef.current === 3) targetFogColor = new THREE.Color('#0d0b28'); // Cosmic Mandala
        else if (activeChapterRef.current === 4) targetFogColor = new THREE.Color('#1f1902'); // Gilded Throne
        
        if (scene.fog) {
          (scene.fog as THREE.FogExp2).color.lerp(targetFogColor, 0.04);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (synthRef.current) {
        synthRef.current.drone.stop();
      }
    };
  }, []);

  // Handle scroll trigger tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollHeight - target.clientHeight;
    if (maxScroll <= 0) return;

    const currentScroll = target.scrollTop;
    const progress = currentScroll / maxScroll;
    setScrollProgress(progress);
    scrollProgressRef.current = progress;

    // Calculate active chapter
    const step = Math.min(CHAPTERS.length - 1, Math.floor(currentScroll / target.clientHeight + 0.45));
    if (step !== activeChapter) {
      setActiveChapter(step);
      activeChapterRef.current = step;
      playChapterCue(step);
    }
  };

  const renderKingdomBackdrop = () => {
    switch (activeChapter) {
      case 0:
        return (
          <motion.div
            key="kingdom-ujjain"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-10"
          >
            {/* Drifting moonlit clouds */}
            <div className="absolute top-1/4 left-10 w-48 h-12 bg-indigo-500/5 rounded-full blur-xl animate-[pulse_6s_infinite_ease-in-out]" />
            <div className="absolute top-1/3 right-12 w-64 h-16 bg-purple-500/5 rounded-full blur-2xl animate-[pulse_8s_infinite_ease-in-out]" />
            
            {/* Ujjain Palace Arch Silhouettes at the bottom with slow horizontal motion */}
            <motion.div 
              animate={{ x: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 w-full max-w-xl h-64 text-[#070514]/65 fill-current opacity-80"
            >
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {/* Indian dome/minaret silhouette */}
                <path d="M 0 200 L 0 100 Q 20 100 20 80 Q 20 40 40 40 Q 60 40 60 80 Q 60 100 80 100 L 80 200 Z" />
                <path d="M 80 200 L 80 80 Q 110 80 115 50 Q 120 20 135 20 Q 150 20 155 50 Q 160 80 190 80 L 190 200 Z" />
                <path d="M 190 200 L 190 120 Q 210 120 210 100 Q 210 70 225 70 Q 240 70 240 100 Q 240 120 260 120 L 260 200 Z" />
                {/* Elegant palace walls with arches */}
                <rect x="260" y="80" width="140" height="120" />
                <path d="M 280 200 L 280 120 Q 300 100 320 120 L 320 200" fill="#04030a" />
                <path d="M 340 200 L 340 120 Q 360 100 380 120 L 380 200" fill="#04030a" />
              </svg>
            </motion.div>

            {/* Floating golden fireflies ascending */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 14 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: '105vh', x: `${10 + (i * 7)}vw`, scale: Math.random() * 0.7 + 0.3 }}
                  animate={{ y: '-5vh', x: `${10 + (i * 7) + Math.sin(i) * 5}vw` }}
                  transition={{ duration: 12 + Math.random() * 10, repeat: Infinity, ease: 'linear', delay: Math.random() * 6 }}
                  className="absolute w-2.5 h-2.5 rounded-full bg-amber-400/40 shadow-[0_0_10px_#f59e0b] blur-[1px]"
                />
              ))}
            </div>
          </motion.div>
        );
      case 1:
        return (
          <motion.div
            key="kingdom-crematorium"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-10"
          >
            {/* Spooky mist layer */}
            <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-emerald-950/20 to-transparent blur-xl" />
            
            {/* Gnarled banyan tree branches with subtle swinging hanging roots */}
            <motion.div
              animate={{ rotate: [-1, 1, -1] }}
              transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
              className="absolute top-0 right-0 w-96 h-96 text-[#03150d]/70 fill-current opacity-70"
            >
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <path d="M 200 0 C 180 20, 160 30, 150 50 C 140 70, 150 90, 130 100 C 110 110, 80 90, 60 110 C 40 130, 50 160, 20 180 L 0 200 L 200 200 Z" />
                {/* Hanging roots */}
                <path d="M 150 50 Q 145 100 148 150" stroke="#041a10" strokeWidth="2.5" fill="none" />
                <path d="M 130 100 Q 120 140 124 180" stroke="#041a10" strokeWidth="1.8" fill="none" />
                <path d="M 110 110 Q 105 150 102 190" stroke="#041a10" strokeWidth="1.2" fill="none" />
              </svg>
            </motion.div>

            {/* Glowing magical green/teal wisps (orbs of knowledge) */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.1, scale: 0.7, x: `${20 + i * 12}%`, y: `${30 + (i % 3) * 15}%` }}
                  animate={{ 
                    opacity: [0.2, 0.7, 0.2], 
                    scale: [0.8, 1.3, 0.8],
                    y: ['25%', '35%', '25%'],
                    x: [`${20 + i * 12}%`, `${20 + i * 12 + 4}%`, `${20 + i * 12}%`]
                  }}
                  transition={{ duration: 7 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-8 h-8 rounded-full bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.5)] blur-md"
                />
              ))}
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="kingdom-ascent"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-10"
          >
            {/* Stone pillars corridor silhouettes */}
            <div className="absolute bottom-0 inset-x-0 w-full h-44 text-[#0c0507]/75 fill-current opacity-85">
              <svg className="w-full h-full" viewBox="0 0 600 100" preserveAspectRatio="none">
                {/* Pillars */}
                <rect x="50" y="0" width="30" height="100" />
                <rect x="40" y="0" width="50" height="10" />
                <rect x="45" y="90" width="40" height="10" />

                <rect x="250" y="0" width="30" height="100" />
                <rect x="240" y="0" width="50" height="10" />
                <rect x="245" y="90" width="40" height="10" />

                <rect x="450" y="0" width="30" height="100" />
                <rect x="440" y="0" width="50" height="10" />
                <rect x="445" y="90" width="40" height="10" />
              </svg>
            </div>

            {/* Moving Flickering torch fire bowls on the pillars */}
            <div className="absolute bottom-32 left-[11%] flex flex-col items-center">
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.75, 1, 0.75], y: [0, -2, 0] }}
                transition={{ repeat: Infinity, duration: 0.28 }}
                className="w-5 h-7 bg-gradient-to-t from-orange-600 via-amber-400 to-transparent rounded-full blur-[1px] shadow-[0_0_15px_#f59e0b]"
              />
            </div>
            <div className="absolute bottom-32 left-[44%] flex flex-col items-center">
              <motion.div 
                animate={{ scale: [1.15, 0.9, 1.15], opacity: [0.85, 0.7, 0.85], y: [-1, 1, -1] }}
                transition={{ repeat: Infinity, duration: 0.24 }}
                className="w-5 h-7 bg-gradient-to-t from-orange-600 via-amber-400 to-transparent rounded-full blur-[1px] shadow-[0_0_15px_#f59e0b]"
              />
            </div>
            <div className="absolute bottom-32 left-[78%] flex flex-col items-center">
              <motion.div 
                animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.7, 1, 0.7], y: [1, -2, 1] }}
                transition={{ repeat: Infinity, duration: 0.32 }}
                className="w-5 h-7 bg-gradient-to-t from-orange-600 via-amber-400 to-transparent rounded-full blur-[1px] shadow-[0_0_15px_#f59e0b]"
              />
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="kingdom-mandala"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-10 flex items-center justify-center"
          >
            {/* Giant rotating sacred geometric cosmic mandala */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
              className="w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] opacity-25"
            >
              <svg className="w-full h-full text-indigo-400 stroke-current fill-none" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" strokeWidth="0.4" />
                <circle cx="100" cy="100" r="72" strokeWidth="0.4" />
                <circle cx="100" cy="100" r="54" strokeWidth="0.4" />
                <circle cx="100" cy="100" r="36" strokeWidth="0.4" />
                {Array.from({ length: 16 }).map((_, i) => (
                  <line 
                    key={i} 
                    x1="100" y1="10" x2="100" y2="190" 
                    transform={`rotate(${i * 11.25} 100 100)`} 
                    strokeWidth="0.3" 
                  />
                ))}
                <polygon 
                  points="100,50 115,85 150,100 115,115 100,150 85,115 50,100 85,85" 
                  strokeWidth="0.6" 
                />
              </svg>
            </motion.div>

            {/* Glowing divine light rays sweeping background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_60%)] animate-pulse" />
          </motion.div>
        );
      case 4:
        return (
          <motion.div
            key="kingdom-gilded"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none overflow-hidden z-10"
          >
            {/* Elegant Golden Arch borders on the edges */}
            <div className="absolute inset-0 text-amber-500/10 fill-current opacity-60">
              <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
                <path d="M 0 0 L 120 0 L 120 600 L 0 600 Z" />
                <path d="M 680 0 L 800 0 L 800 600 L 680 600 Z" />
                <path d="M 120 0 Q 400 120 680 0 L 680 15 L 120 15 Z" />
              </svg>
            </div>

            {/* Cascading stardust sparks waterfall drifting down */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 28 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -20, x: `${Math.random() * 100}%`, opacity: Math.random() * 0.8 + 0.2, scale: Math.random() * 0.7 + 0.3 }}
                  animate={{ y: '105vh' }}
                  transition={{ duration: 5 + Math.random() * 7, repeat: Infinity, ease: 'linear', delay: Math.random() * 5 }}
                  className="absolute w-1.5 h-3.5 rounded-full bg-gradient-to-b from-amber-400 to-transparent shadow-[0_0_8px_#f59e0b]"
                />
              ))}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      id="story-landing-overlay-viewport" 
      className="fixed inset-0 z-[999] bg-[#04030a] text-slate-100 overflow-hidden select-none font-sans"
    >
      {/* 3D Core Canvas background */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-0" 
      />

      {/* Dynamic Kingdom Backdrops underlaying textual components */}
      <AnimatePresence mode="wait">
        {curtainsOpened && renderKingdomBackdrop()}
      </AnimatePresence>

      {/* Background radial atmosphere shadows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#04030a_95%)] pointer-events-none z-10" />

      {/* Header controls HUD */}
      <header className="absolute top-0 inset-x-0 z-50 p-6 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.25)]">
            <Flame className="w-4.5 h-4.5 text-amber-500 fill-amber-500/20 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-serif font-bold tracking-widest text-slate-200 uppercase">
              The Sovereign's Ascent
            </h1>
            <p className="text-[9px] text-slate-500 font-mono">Spaced Chronicle Introduction</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl transition-all border pointer-events-auto flex items-center gap-2 text-[10px] font-mono cursor-pointer ${
              isPlayingSound 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {isPlayingSound ? (
              <>
                <Volume2 className="w-3.5 h-3.5" /> Ambient Synth Active
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" /> Sound Synthesizer Off
              </>
            )}
          </button>

          {/* Quick Skip Button */}
          <button
            onClick={onComplete}
            id="btn-skip-prologue"
            className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-[10px] font-mono font-bold px-4 py-2 rounded-xl transition-all pointer-events-auto hover:border-amber-500/30 hover:text-amber-400 cursor-pointer flex items-center gap-1.5"
          >
            Skip Prologue <Compass className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>
      </header>

      {/* Gold-Etched Timeline Progress indicator on the left edge */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-5 items-center">
        <span className="text-[9px] font-mono text-slate-600 rotate-270 mb-4 tracking-widest uppercase">Chronology</span>
        <div className="relative w-[2px] h-48 bg-slate-900">
          <div 
            className="absolute top-0 left-0 w-full bg-amber-500 transition-all duration-100 shadow-[0_0_8px_#f59e0b]"
            style={{ height: `${scrollProgress * 100}%` }}
          />
        </div>
        <div className="flex flex-col gap-2.5 mt-4">
          {CHAPTERS.map((_, idx) => (
            <div 
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                idx === activeChapter 
                  ? 'bg-amber-500 scale-150 shadow-[0_0_8px_#f59e0b]' 
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Centered Scrollable content layer */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 z-20 overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-none h-full w-full"
      >
        {CHAPTERS.map((chapter, index) => {
          const isActive = index === activeChapter;

          return (
            <section 
              key={chapter.id}
              className="h-screen w-full flex items-center justify-center snap-start relative px-4 sm:px-6 pointer-events-none"
            >
              <div className="max-w-xl w-full text-center sm:text-left sm:ml-auto sm:mr-16 bg-slate-950/80 border border-slate-900 p-6 sm:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden pointer-events-auto">
                {/* Gold glowing border line */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                
                <span className="text-[10px] font-mono tracking-widest text-amber-500 font-bold block mb-1">
                  {chapter.subtitle}
                </span>

                <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-100 tracking-wider mb-3 leading-tight">
                  {chapter.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans mb-4">
                  {chapter.body}
                </p>

                {/* Mythological Significance note */}
                <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-4 text-[11px] text-slate-400 italic font-mono leading-relaxed relative">
                  <span className="absolute -top-2 left-3 bg-slate-950 px-2 text-[9px] font-mono tracking-wider text-slate-500 font-semibold uppercase">
                    Karmic Law
                  </span>
                  "{chapter.mythos}"
                </div>

                {/* Navigation Button or call to action on the final slide */}
                {index === CHAPTERS.length - 1 ? (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={onComplete}
                    id="btn-story-complete-enter-app"
                    className="w-full mt-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-mono font-bold text-xs py-3.5 px-4 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Award className="w-4 h-4 text-slate-950 animate-pulse" /> ENTER THE HABIT CHRONICLES
                  </motion.button>
                ) : (
                  <div className="mt-5 flex items-center justify-center sm:justify-start gap-1.5 text-[10px] font-mono text-slate-500">
                    <ChevronDown className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                    <span>Scroll or swipe down to advance</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Floating Scroll Prompt at center-bottom */}
      {activeChapter < CHAPTERS.length - 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 text-[10px] font-mono text-slate-500 pointer-events-none animate-pulse">
          <span>Explore Chapter {activeChapter + 2}</span>
          <div className="w-4 h-7 border border-slate-700 rounded-full flex justify-center p-1">
            <div className="w-1 h-1.5 bg-amber-500 rounded-full animate-scroll-hint" />
          </div>
        </div>
      )}

      {/* Royal Curtains Entrance Stage Layer */}
      <AnimatePresence>
        {!curtainsOpened && (
          <motion.div 
            key="curtain-viewport"
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut", delay: 0.2 }}
            className="absolute inset-0 z-[100] overflow-hidden flex"
          >
            {/* Left Velvet Curtain */}
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: '-102%' }}
              transition={{ duration: 1.8, ease: [0.77, 0, 0.175, 1] }}
              className="w-1/2 h-full bg-gradient-to-r from-[#170306] via-[#3a0a13] to-[#24060b] relative border-r-4 border-amber-500/40 shadow-[15px_0_40px_rgba(0,0,0,0.9)] flex flex-col justify-center items-end"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(0, 0, 0, 0.22) 35px, rgba(0, 0, 0, 0.22) 70px)'
              }}
            >
              {/* Gold tassel cord detail */}
              <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-amber-600 via-yellow-400 to-amber-700 opacity-80" />
            </motion.div>

            {/* Right Velvet Curtain */}
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: '102%' }}
              transition={{ duration: 1.8, ease: [0.77, 0, 0.175, 1] }}
              className="w-1/2 h-full bg-gradient-to-l from-[#170306] via-[#3a0a13] to-[#24060b] relative border-l-4 border-amber-500/40 shadow-[-15px_0_40px_rgba(0,0,0,0.9)] flex flex-col justify-center items-start"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(0, 0, 0, 0.22) 35px, rgba(0, 0, 0, 0.22) 70px)'
              }}
            >
              {/* Gold tassel cord detail */}
              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-amber-600 via-yellow-400 to-amber-700 opacity-80" />
            </motion.div>

            {/* Central Seal & Majestic Royal Gate call-to-action */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-[110] text-center px-4 py-8 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="max-w-4xl w-full bg-slate-950/95 border-2 border-amber-500/40 rounded-3xl backdrop-blur-md shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col md:flex-row relative"
              >
                {/* Gold ornate frame accents */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-500/70" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-500/70" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-500/70" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-500/70" />

                {/* Left Side: Large Cinematic Character Portrait */}
                <div className="w-full md:w-1/2 h-[220px] sm:h-[300px] md:h-[480px] relative overflow-hidden group border-b md:border-b-0 md:border-r border-amber-500/20">
                  <img 
                    src={vikramBetaalCover} 
                    alt="King Vikram carrying Betaal" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center scale-102 group-hover:scale-105 transition-transform duration-[10000ms] ease-out"
                  />
                  {/* Majestic Golden Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-950/90" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(4,3,10,0.8)_100%)]" />
                  
                  {/* Character Identity Badges */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-left pointer-events-none">
                    <div className="bg-slate-950/80 border border-amber-500/30 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                      <p className="text-[8px] font-mono text-amber-500 tracking-widest uppercase">THE SOVEREIGN</p>
                      <h4 className="text-xs font-serif font-bold text-slate-100">King Vikramaditya</h4>
                    </div>
                    <div className="bg-slate-950/80 border border-indigo-500/30 px-3 py-1.5 rounded-xl backdrop-blur-sm text-right">
                      <p className="text-[8px] font-mono text-indigo-400 tracking-widest uppercase">THE SPECTRAL SOUL</p>
                      <h4 className="text-xs font-serif font-bold text-slate-100">The Betaal</h4>
                    </div>
                  </div>

                  {/* Tiny light flare */}
                  <div className="absolute top-1/4 left-1/3 w-2 h-2 rounded-full bg-amber-400/80 blur-sm animate-pulse shadow-[0_0_15px_#f59e0b]" />
                </div>

                {/* Right Side: Royal Details & Action */}
                <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between text-left space-y-6 md:space-y-0">
                  <div className="space-y-4">
                    {/* Royal crest */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                        <Crown className="w-5 h-5 text-slate-950" />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-indigo-400 tracking-widest uppercase font-bold block">
                          ESTABLISHED 2026 • CHRONICLE
                        </span>
                        <h3 className="text-xs font-mono font-semibold text-amber-500/90 uppercase tracking-widest">
                          The Royal Court of Ujjain
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 tracking-wider uppercase leading-none">
                        Vikram & Betaal
                      </h2>
                      <p className="text-[10px] font-mono text-slate-400 tracking-widest uppercase font-semibold">
                        The Spaced Chronicles of Habit and Will
                      </p>
                    </div>

                    <div className="h-[1px] bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />

                    <p className="text-xs text-slate-300 leading-relaxed font-sans italic pt-1">
                      “Under the sacred banyan tree, the king committed his silent vows. Carry the corpse of your burdens, solve the spectral riddles of discipline, and earn the sovereign's blessing of unbreakable habits.”
                    </p>

                    {/* Features checklist highlights */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <Swords className="w-3.5 h-3.5 text-amber-500" />
                        <span>25 Mythic Riddles</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <Shield className="w-3.5 h-3.5 text-amber-500" />
                        <span>Sovereign Streaks</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <Ghost className="w-3.5 h-3.5 text-amber-500" />
                        <span>Interactive 3D Stage</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Karmic AI Counsel</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 md:pt-0">
                    <button
                      onClick={() => {
                        setCurtainsOpened(true);
                        toggleSound(); // Auto-start musical sound synth
                      }}
                      className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-mono font-bold text-xs py-4 px-6 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.25)] transition-all hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] hover:scale-[1.01] active:scale-98 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                    >
                      <Swords className="w-4 h-4 text-slate-950 animate-pulse" /> UNVEIL THE ROYAL CHRONICLES
                    </button>
                    <p className="text-[8px] text-center text-slate-500 font-mono mt-2.5 uppercase tracking-widest">
                      Press to open the golden curtains and enter the kingdom
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
