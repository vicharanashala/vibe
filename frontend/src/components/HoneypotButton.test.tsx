import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { HoneypotButton } from '@/components/HoneypotButton';
import * as securityApi from '@/lib/security-api';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/lib/security-api');
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({
    pathname: '/test-page',
  }),
}));

describe('HoneypotButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the honeypot button', () => {
    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });
    expect(honeypotButton).toBeInTheDocument();
  });

  it('should have aria-hidden="true"', () => {
    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });
    expect(honeypotButton).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have tabIndex={-1}', () => {
    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });
    expect(honeypotButton).toHaveAttribute('tabindex', '-1');
  });

  it('should have honeypot data attribute', () => {
    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });
    expect(honeypotButton).toHaveAttribute('data-honeypot', 'true');
  });

  it('should apply hiding CSS styles', () => {
    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true }) as HTMLElement;

    const styles = honeypotButton.getAttribute('style');
    expect(styles).toContain('opacity: 0');
    expect(styles).toContain('position: absolute');
    expect(styles).toContain('left: -9999px');
    expect(styles).toContain('z-index: -1');
  });

  it('should call recordHoneypotTrigger when clicked', async () => {
    const mockRecordHoneypotTrigger = vi.spyOn(
      securityApi,
      'recordHoneypotTrigger',
    );
    mockRecordHoneypotTrigger.mockResolvedValue({
      status: 'success',
      message: 'Thank you for your submission',
    });

    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });

    fireEvent.click(honeypotButton);

    await waitFor(() => {
      expect(mockRecordHoneypotTrigger).toHaveBeenCalled();
    });
  });

  it('should send correct payload to recordHoneypotTrigger', async () => {
    const mockRecordHoneypotTrigger = vi.spyOn(
      securityApi,
      'recordHoneypotTrigger',
    );
    mockRecordHoneypotTrigger.mockResolvedValue({
      status: 'success',
      message: 'Thank you for your submission',
    });

    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });

    fireEvent.click(honeypotButton);

    await waitFor(() => {
      expect(mockRecordHoneypotTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRoute: '/test-page',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockRecordHoneypotTrigger = vi.spyOn(
      securityApi,
      'recordHoneypotTrigger',
    );
    mockRecordHoneypotTrigger.mockRejectedValue(new Error('API Error'));

    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });

    // Should not throw
    expect(() => {
      fireEvent.click(honeypotButton);
    }).not.toThrow();
  });

  it('should prevent duplicate requests', async () => {
    const mockRecordHoneypotTrigger = vi.spyOn(
      securityApi,
      'recordHoneypotTrigger',
    );
    mockRecordHoneypotTrigger.mockResolvedValue({
      status: 'success',
      message: 'Thank you for your submission',
    });

    render(<HoneypotButton />);
    const honeypotButton = screen.getByRole('button', { hidden: true });

    // Click multiple times rapidly
    fireEvent.click(honeypotButton);
    fireEvent.click(honeypotButton);

    await waitFor(() => {
      // Should only be called once due to pending flag
      expect(mockRecordHoneypotTrigger).toHaveBeenCalledTimes(1);
    });
  });

  it('should have displayName for debugging', () => {
    expect(HoneypotButton.displayName).toBe('HoneypotButton');
  });
});
