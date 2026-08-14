import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { Flame } from 'lucide-react';

interface StreakCountUpProps {
  value: number;
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: string;
}

export const StreakCountUp: React.FC<StreakCountUpProps> = ({ value, className = "" }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevValueRef = useRef(value);
  const controls = useAnimation();

  useEffect(() => {
    const prevValue = prevValueRef.current;
    if (value > prevValue) {
      // 1. Pop the text using framer-motion controls
      controls.start({
        scale: [1, 1.4, 0.95, 1],
        color: ["#e2e8f0", "#fbbf24", "#6366f1", "#e2e8f0"],
        transition: { duration: 0.6, ease: "easeOut" }
      });

      // 2. Spawn golden fire particles around the number
      const newParticles: Particle[] = Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
        const distance = 25 + Math.random() * 35;
        const colors = ["#f59e0b", "#fbbf24", "#fb7185", "#c084fc", "#6366f1"];
        return {
          id: Math.random() + i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          scale: 0.5 + Math.random() * 0.8,
          color: colors[Math.floor(Math.random() * colors.length)]
        };
      });
      setParticles(newParticles);

      // Clean up particles after they animate out
      setTimeout(() => setParticles([]), 1200);

      // 3. Count up animation
      let start = prevValue;
      const end = value;
      const range = end - start;
      const duration = 600; // ms
      const stepTime = Math.max(Math.floor(duration / range), 15);
      
      const timer = setInterval(() => {
        start += 1;
        if (start >= end) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(start);
        }
      }, stepTime);

    } else {
      // If decreased or reset, just jump to value
      setDisplayValue(value);
    }
    prevValueRef.current = value;
  }, [value, controls]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Sparkle Particles Burst */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: p.scale }}
            animate={{ 
              x: p.x, 
              y: p.y, 
              opacity: 0, 
              scale: 0,
              rotate: Math.random() * 360
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            className="absolute w-2 h-2 rounded-full pointer-events-none z-30"
            style={{ 
              backgroundColor: p.color,
              boxShadow: `0 0 8px ${p.color}`
            }}
          />
        ))}
      </AnimatePresence>

      {/* Pulsing ring during increment */}
      {particles.length > 0 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none z-10"
        />
      )}

      {/* Main Animated Number */}
      <motion.span
        animate={controls}
        className="font-mono text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-1"
      >
        {displayValue}
      </motion.span>
    </div>
  );
};
