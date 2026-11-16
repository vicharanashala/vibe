import React, { useRef, useState, useEffect } from 'react';
import {
  Undo,
  Trash2,
  Download,
  X,
  Brush,
  ChevronDown,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface SnapshotSketchModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string; // Captured frame URL or Base64
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#a855f7', // Purple
  '#ffffff', // White
  '#000000', // Black
];

export default function SnapshotSketchModal({
  isOpen,
  onClose,
  imageSrc
}: SnapshotSketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [brushColor, setBrushColor] = useState('#ef4444'); // Default red
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Load and fit background image when imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas internal dimensions to match the source image resolution
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;

      // Clear and draw image background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Save initial blank sketch state to history
      setHistory([canvas.toDataURL()]);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  // Helper: get coordinates relative to canvas internal pixels
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Scale client coords to match internal canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent scrolling on touch screens
    if (e.cancelable) {
      e.preventDefault();
    }
    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    lastPosRef.current = coords;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) {
      e.preventDefault();
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPosRef.current = coords;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Save state to history stack on draw stop
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory((prev) => [...prev, canvas.toDataURL()]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return; // Keep the original clean frame

    const newHistory = [...history];
    newHistory.pop(); // Remove the latest state
    setHistory(newHistory);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = newHistory[newHistory.length - 1];
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistory([canvas.toDataURL()]);
      toast.success('Drawing cleared!');
    };
    img.src = imageSrc;
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = `snapshot_note_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Snapshot exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export canvas.');
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999999] flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200"
    >
      <Card className="w-full max-w-5xl bg-neutral-900 border-neutral-800 text-white shadow-2xl overflow-hidden rounded-xl">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-rose-600/10 rounded-lg">
              <Brush className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-none">Snapshot & Sketch</h3>
              <p className="text-xs text-neutral-400 mt-1">Annotate the captured video frame and save it locally</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-neutral-800 bg-neutral-900/60">
          {/* Colors selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mr-1">Colors</span>
            <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1.5 rounded-lg border border-neutral-800">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    brushColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="w-px h-5 bg-neutral-800 mx-1.5" />
              {/* Color Picker Icon button wrapper */}
              <div className="relative flex items-center justify-center cursor-pointer">
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
                />
                <Palette className="h-5 w-5 text-neutral-400 hover:text-white" />
              </div>
            </div>
          </div>

          {/* Size slider */}
          <div className="flex items-center gap-3 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 min-w-[180px] flex-1 max-w-[240px]">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Size</span>
            <Slider
              value={[brushSize]}
              min={1}
              max={20}
              step={1}
              onValueChange={(val) => setBrushSize(val[0])}
              className="flex-1"
            />
            <span className="text-xs font-bold text-rose-500 w-6 text-right">{brushSize}px</span>
          </div>

          <div className="flex-grow" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="border-neutral-800 bg-neutral-950 text-white hover:bg-neutral-800"
            >
              <Undo className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="border-neutral-800 bg-neutral-950 text-rose-500 hover:bg-rose-950/20 hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
          </div>
        </div>

        {/* Drawing Workspace */}
        <CardContent className="p-4 bg-neutral-950/80 flex items-center justify-center min-h-[460px] max-h-[70vh] overflow-auto">
          <div className="relative border border-neutral-800 shadow-2xl rounded-lg overflow-hidden max-w-full">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="block cursor-crosshair bg-neutral-900 max-w-full h-auto object-contain"
              style={{ maxHeight: 'calc(70vh - 40px)' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
