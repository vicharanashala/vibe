import React, { useEffect, useRef } from 'react';

interface ConfettiEffectProps {
  trigger: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
}

const COLORS = [
  '#f59e0b', // gold/amber
  '#d4af37', // metallic gold
  '#fbbf24', // bright gold
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ef4444'  // red
];

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ trigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationFrameId: number;
    const particles: Particle[] = [];

    // Create 150 particles bursting outward from the center
    const createBurst = () => {
      const startX = canvas.width / 2;
      const startY = canvas.height * 0.45; // slightly above middle

      for (let i = 0; i < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 12;

        particles.push({
          x: startX,
          y: startY,
          size: 6 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          speedX: Math.cos(angle) * speed,
          speedY: Math.sin(angle) * speed - 2, // slight upward bias
          rotation: Math.random() * 360,
          rotationSpeed: -4 + Math.random() * 8,
          wobble: Math.random() * 10,
          wobbleSpeed: 0.05 + Math.random() * 0.1,
          opacity: 1
        });
      }
    };

    createBurst();

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.opacity <= 0) continue;

        activeCount++;

        // Update physics
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.22; // gravity
        p.speedX *= 0.98; // friction
        p.speedY *= 0.98;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        // Fade out as it falls
        if (p.speedY > 2) {
          p.opacity -= 0.012;
        }

        // Draw particle
        ctx.save();
        ctx.translate(p.x + Math.sin(p.wobble) * 4, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;

        // Draw rectangle
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      if (activeCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [trigger]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100] w-screen h-screen"
    />
  );
};
