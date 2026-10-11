import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { securityApi } from '@/lib/security-api';
import { useLocation } from '@tanstack/react-router';

/**
 * HoneypotButton Component
 *
 * A hidden honeypot button that mimics a real action button but is never visible
 * to legitimate users. It's designed to detect automated interactions and bots.
 *
 * Hiding technique: Uses multiple CSS techniques rather than display:none or visibility:hidden
 * - opacity: 0 (fully transparent)
 * - position: absolute (taken out of document flow)
 * - left: -9999px (positioned far off-screen)
 * - width/height: 1px (minimal size)
 * - z-index: -1 (behind all elements)
 *
 * Accessibility: aria-hidden to hide from screen readers, tabIndex={-1} to hide from tab order
 *
 * Behavior: When clicked, sends a POST request to /api/security/honeypot-triggered
 * with metadata that helps identify the trigger source.
 */
export const HoneypotButton = React.memo(() => {
  const location = useLocation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const requestPendingRef = useRef(false);

  const handleHoneypotClick = async () => {
    // Prevent duplicate requests
    if (requestPendingRef.current) return;

    requestPendingRef.current = true;

    try {
      // Get session ID from storage if available
      const sessionId = localStorage.getItem('sessionId') || undefined;

      // Record honeypot trigger with minimal metadata
      await securityApi.recordHoneypotTrigger({
        sessionId,
        currentRoute: location.pathname,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Silently fail - honeypot detection should never break user experience
      console.debug('[SECURITY] Honeypot trigger error:', error);
    } finally {
      requestPendingRef.current = false;
    }
  };

  return (
    <Button
      ref={buttonRef}
      onClick={handleHoneypotClick}
      aria-hidden="true"
      tabIndex={-1}
      type="button"
      style={{
        opacity: 0,
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        zIndex: -1,
        pointerEvents: 'none',
      }}
      // Minimize visibility in DevTools
      className="honeypot-button"
      data-honeypot="true"
    >
      Next
    </Button>
  );
});

HoneypotButton.displayName = 'HoneypotButton';
