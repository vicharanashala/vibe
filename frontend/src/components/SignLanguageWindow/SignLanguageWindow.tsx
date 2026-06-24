import React, { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { X, Hand } from 'lucide-react';
import styles from './SignLanguageWindow.module.css';
import { useSyncPlayback } from '@/hooks/useSyncPlayback';

export interface SignLanguageWindowProps {
  isVisible: boolean;
  onClose: () => void;
  interpreterVideoSrc: string | null;
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement>;
}

export default function SignLanguageWindow({
  isVisible,
  onClose,
  interpreterVideoSrc,
  playing,
  currentTime,
  playbackRate,
  position,
  size,
  onPositionChange,
  onSizeChange,
  returnFocusRef,
}: SignLanguageWindowProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);

  useSyncPlayback(videoRef, isVisible ? playing : false, currentTime, playbackRate);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle src lifecycle (preload="none" + memory freeing without unmounting the video element)
  useEffect(() => {
    if (isVisible && interpreterVideoSrc) {
      setActiveSrc(interpreterVideoSrc);
    } else {
      // Free memory when hidden by clearing src, but keep the video element mounted
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src'); 
        videoRef.current.load();
      }
      setActiveSrc(null);
    }
  }, [isVisible, interpreterVideoSrc]);

  // Focus trap & Escape to close
  useEffect(() => {
    if (isVisible) {
      // Move focus inside
      closeBtnRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          returnFocusRef?.current?.focus();
        }
        
        // Basic focus trap (prevent tabbing out)
        if (e.key === 'Tab') {
          e.preventDefault();
          closeBtnRef.current?.focus();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, onClose, returnFocusRef]);

  if (!isVisible) return null;

  const content = (
    <div 
      className={`${styles.container} ${isDragging ? styles.containerDragging : ''}`}
      role="dialog"
      aria-label="Sign language interpreter"
      ref={containerRef}
    >
      <div className={`${styles.header} rnd-drag-handle`}>
        <div className={styles.title}>
          <Hand size={14} />
          <span>Interpreter</span>
        </div>
        <button 
          ref={closeBtnRef}
          className={styles.closeButton} 
          onClick={() => {
            onClose();
            returnFocusRef?.current?.focus();
          }}
          aria-label="Close sign language interpreter"
        >
          <X size={16} />
        </button>
      </div>
      <div className={styles.videoWrapper}>
        {activeSrc ? (
          <video
            ref={videoRef}
            src={activeSrc}
            className={styles.video}
            preload="none"
            playsInline
            muted
            aria-label="Sign language video"
          />
        ) : (
          <div className={styles.placeholder}>
            <span style={{ fontSize: '24px' }}>🤟</span>
            <p>No sign language track available for this lecture</p>
          </div>
        )}
      </div>
      {/* Screen reader announcement area */}
      <div aria-live="polite" className={styles.srOnly}>
        {isVisible ? 'Sign language interpreter opened' : 'Sign language interpreter closed'}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '180px', height: '100px', zIndex: 9999 }}>
        {content}
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={{ x: position.x, y: position.y }}
      onDragStart={() => setIsDragging(true)}
      onDragStop={(e, d) => {
        setIsDragging(false);
        onPositionChange({ x: d.x, y: d.y });
      }}
      onResizeStart={() => setIsDragging(true)}
      onResizeStop={(e, direction, ref, delta, position) => {
        setIsDragging(false);
        onSizeChange({
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
        });
        onPositionChange(position);
      }}
      minWidth={160}
      minHeight={90}
      maxWidth={480}
      maxHeight={270}
      bounds="window"
      dragHandleClassName="rnd-drag-handle"
      style={{ zIndex: 9999 }}
      disableDragging={false}
    >
      {content}
    </Rnd>
  );
}
