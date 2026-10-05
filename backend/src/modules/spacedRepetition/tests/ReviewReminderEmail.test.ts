import { describe, it, expect } from 'vitest';
import { ReviewReminderEmail } from '#root/modules/notifications/classes/transformers/ReviewReminderEmail.js';

describe('ReviewReminderEmail', () => {

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const BASE_PARAMS = {
    studentEmail: 'student@example.com',
    dueCount: 5,
    courseNames: ['Biology 101', 'Chemistry Basics'],
    totalCourseCount: 2,
  };

  // ── Tests ───────────────────────────────────────────────────────────────────

  describe('createMessage', () => {

    it('returns a valid SendMailOptions-shaped object', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);

      expect(msg).toHaveProperty('to', 'student@example.com');
      expect(msg).toHaveProperty('subject');
      expect(msg).toHaveProperty('text');
      expect(msg).toHaveProperty('html');
      expect(msg).not.toHaveProperty('from'); // caller sets 'from'
    });

    // ── Subject ──────────────────────────────────────────────────────────────

    it('subject uses singular "question" when dueCount is 1', () => {
      const msg = ReviewReminderEmail.createMessage({ ...BASE_PARAMS, dueCount: 1 });
      expect(msg.subject).toMatch(/1 question/);
    });

    it('subject uses plural "questions" when dueCount > 1', () => {
      const msg = ReviewReminderEmail.createMessage({ ...BASE_PARAMS, dueCount: 5 });
      expect(msg.subject).toMatch(/5 questions/);
    });

    // ── Text version ─────────────────────────────────────────────────────────

    it('text body uses singular "question" when dueCount is 1', () => {
      const msg = ReviewReminderEmail.createMessage({ ...BASE_PARAMS, dueCount: 1 });
      expect(msg.text).toMatch(/1 question/);
    });

    it('text body uses plural "questions" when dueCount > 1', () => {
      const msg = ReviewReminderEmail.createMessage({ ...BASE_PARAMS, dueCount: 3 });
      expect(msg.text).toMatch(/3 questions/);
    });

    it('text body mentions all course names', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.text).toContain('Biology 101');
      expect(msg.text).toContain('Chemistry Basics');
    });

    it('text body appends "and N more" when there are more courses than named', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: ['Biology 101'],
        totalCourseCount: 4,
      });
      expect(msg.text).toMatch(/and 3 more/);
    });

    it('text body does NOT append "and N more" when courseNames.length === totalCourseCount', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: ['Biology 101', 'Chemistry Basics'],
        totalCourseCount: 2,
      });
      expect(msg.text).not.toMatch(/and \d+ more/);
    });

    it('text body includes CTA URL when provided', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        ctaUrl: 'https://vibe.edu/student/review',
      });
      expect(msg.text).toMatch(/https:\/\/vibe\.edu\/student\/review/);
    });

    it('text body falls back to generic CTA when ctaUrl is not provided', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.text).toMatch(/Log in to ViBe to start your review session/);
    });

    it('text body falls back to course ID when course name is unavailable', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: ['unknown_course_123'],
        totalCourseCount: 1,
      });
      expect(msg.text).toContain('unknown_course_123');
    });

    // ── HTML version ─────────────────────────────────────────────────────────

    it('html body contains the student greeting with firstName', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        studentName: 'Priya',
      });
      expect(msg.html).toContain('Hi Priya,');
    });

    it('html body contains generic greeting when studentName is absent', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.html).toContain('Hi there,');
    });

    it('html body contains course names', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.html).toContain('Biology 101');
      expect(msg.html).toContain('Chemistry Basics');
    });

    it('html body contains the CTA button when ctaUrl is provided', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        ctaUrl: 'https://vibe.edu/student/review',
      });
      expect(msg.html).toMatch(/Start Review Session/);
      expect(msg.html).toMatch(/href="https:\/\/vibe\.edu\/student\/review"/);
    });

    it('html body does NOT contain CTA button when ctaUrl is absent', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.html).not.toMatch(/Start Review Session/);
    });

    it('html body contains the privacy / opt-out footer', () => {
      const msg = ReviewReminderEmail.createMessage(BASE_PARAMS);
      expect(msg.html).toMatch(/spaced repetition reminders enabled/);
      expect(msg.html).toMatch(/Manage your notification preferences/);
    });

    it('html body renders bullet list of courses using • character', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: ['Physics 101', 'Maths'],
        totalCourseCount: 2,
      });
      expect(msg.html).toContain('• Physics 101');
      expect(msg.html).toContain('• Maths');
    });

    it('html body appends "and N more" bullet when courses exceed courseNames', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: ['Physics 101'],
        totalCourseCount: 3,
      });
      expect(msg.html).toMatch(/and 2 more/);
    });

    // ── Edge cases ───────────────────────────────────────────────────────────

    it('handles zero dueCount gracefully', () => {
      const msg = ReviewReminderEmail.createMessage({ ...BASE_PARAMS, dueCount: 0 });
      expect(msg.subject).toMatch(/0 questions/);
      expect(msg.text).toMatch(/0 questions/);
    });

    it('handles empty courseNames array gracefully', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        courseNames: [],
        totalCourseCount: 0,
      });
      // Should not throw — text joins empty array cleanly
      expect(msg.text).toBeDefined();
      expect(msg.html).toBeDefined();
    });

    it('handles undefined studentName gracefully', () => {
      const msg = ReviewReminderEmail.createMessage({
        ...BASE_PARAMS,
        studentName: undefined,
      });
      expect(msg.html).toContain('Hi there,');
      expect(msg.text).toBeDefined();
    });

  });

});