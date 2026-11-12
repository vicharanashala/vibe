import React, { useState, useRef } from 'react';
import { Camera, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VibeLensOverlayProps {
  isActive: boolean;
  imageSrc: string;
  onCancel: () => void;
  onAskAI: (cropArea: { x: number; y: number; width: number; height: number }) => void;
}

export default function VibeLensOverlay({
  isActive,
  imageSrc,
  onCancel,
  onAskAI,
}: VibeLensOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  if (!isActive) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    startPosRef.current = { x, y };
    setSelection({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isSelecting || !selection || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startPosRef.current.x, currentX);
    const y = Math.min(startPosRef.current.y, currentY);
    const w = Math.abs(startPosRef.current.x - currentX);
    const h = Math.abs(startPosRef.current.y - currentY);

    setSelection({ x, y, w, h });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsSelecting(false);
    // Ignore tiny accidental selections
    if (selection && (selection.w < 10 || selection.h < 10)) {
      setSelection(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    setIsSelecting(true);
    startPosRef.current = { x, y };
    setSelection({ x, y, w: 0, h: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isSelecting || !selection || !containerRef.current || e.touches.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.touches[0].clientX - rect.left;
    const currentY = e.touches[0].clientY - rect.top;

    const x = Math.min(startPosRef.current.x, currentX);
    const y = Math.min(startPosRef.current.y, currentY);
    const w = Math.abs(startPosRef.current.x - currentX);
    const h = Math.abs(startPosRef.current.y - currentY);

    setSelection({ x, y, w, h });
  };

  const handleConfirm = () => {
    if (!selection || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Convert coordinates to percentages relative to container
    const cropArea = {
      x: (selection.x / rect.width) * 100,
      y: (selection.y / rect.height) * 100,
      width: (selection.w / rect.width) * 100,
      height: (selection.h / rect.height) * 100,
    };

    onAskAI(cropArea);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 z-40 bg-black/50 select-none cursor-crosshair overflow-hidden"
    >
      {/* Background Frame Image */}
      <img
        src={imageSrc}
        alt="Captured frame"
        className="w-full h-full object-cover opacity-90 pointer-events-none select-none"
      />

      {/* Guide/Instruction Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 border border-neutral-800 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-white shadow-xl pointer-events-none transition-all animate-bounce">
        <Camera className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold">Drag to select any area to solve with AI</span>
      </div>

      {/* Cancel Button */}
      <Button
        size="icon"
        variant="ghost"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="absolute top-4 right-4 bg-black/60 hover:bg-neutral-800 text-white rounded-full h-8 w-8 z-50 border border-neutral-800"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Bounding Box Selection Render */}
      {selection && (
        <div
          className="absolute border border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] pointer-events-none bg-cyan-500/10 transition-[border-color,background-color] duration-100 ease-out"
          style={{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            width: `${selection.w}px`,
            height: `${selection.h}px`,
          }}
        >
          {/* Glowing Corners */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-300" />

          {/* Simulated scanning animation line */}
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_8px_cyan] animate-pulse" style={{ top: '50%' }} />

          {/* Random mock detection dots to mimic Google Lens AI anchor points */}
          {selection.w > 60 && selection.h > 40 && (
            <>
              <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-white/70 animate-ping" />
              <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 rounded-full bg-white/70 animate-ping delay-500" />
            </>
          )}

          {/* Solve/Analyze Button Tooltip - Only show when mouse is not drawing */}
          {!isSelecting && selection.w > 20 && (
            <div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center pointer-events-auto"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm();
              }}
            >
              <Button
                size="sm"
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-lg flex items-center gap-1.5 h-8 rounded-full px-4 border border-cyan-300 transition-transform active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask ViBe AI
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
