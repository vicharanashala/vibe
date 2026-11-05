/**
 * Landing page copy. Every claim here is grounded in the ViBe repo (README,
 * the ethics-consent text, and how the platform actually behaves) — keep it
 * that way: no invented stats, testimonials, or partner logos.
 */

export const LOGIN_HREF = '/login' as const;
export const SIGNUP_HREF = '/signup' as const;
export const GITHUB_HREF = 'https://github.com/vicharanashala/vibe';
export const DOCS_HREF = 'https://vicharanashala.github.io/vibe/';
export const CONTACT_EMAIL = 'dled@iitrpr.ac.in';

export const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Integrity', href: '#integrity' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const STEPS = [
  {
    title: 'Watch a focused segment',
    body: 'Lessons are broken into short video segments and readings, so you take in one idea at a time.',
  },
  {
    title: 'Answer a checkpoint',
    body: 'Questions drawn from what you just covered check that the idea actually landed.',
  },
  {
    title: 'Review, then move on',
    body: 'Miss it and you revisit the material before trying again. Get it right and the next part unlocks.',
  },
] as const;

export const FEATURES = [
  {
    icon: 'target',
    title: 'Mastery before progress',
    body: 'Continuous assessment makes sure you understand each part before the course moves ahead.',
  },
  {
    icon: 'sparkles',
    title: 'Questions from the lesson itself',
    body: 'AI-assisted question generation produces challenges that are relevant to the content you just studied.',
  },
  {
    icon: 'bookmark',
    title: 'Pick up where you left off',
    body: 'ViBe remembers your place in every course, down to the module, section and item.',
  },
  {
    icon: 'chart',
    title: 'See your progress',
    body: 'Track completion across the whole course and module by module.',
  },
  {
    icon: 'shield',
    title: 'Fair assessments',
    body: 'Smart proctoring keeps assessments honest, so your results mean something.',
  },
  {
    icon: 'code',
    title: 'Open source',
    body: 'ViBe is built in the open and released under the MIT licence.',
  },
] as const;

export const INTEGRITY_POINTS = [
  {
    title: 'Consent comes first',
    body: 'You read and sign a participant consent form before entering a proctored course.',
  },
  {
    title: 'Camera and microphone, only while learning',
    body: 'They are used on proctored lessons to check that you are present and working on your own.',
  },
  {
    title: 'Still images, only on an anomaly',
    body: 'The software captures a still image from your webcam only when something unusual is detected. Audio is monitored.',
  },
  {
    title: 'You are told, not silently flagged',
    body: 'If something looks off — no one in frame, or more than one person — the lesson pauses and tells you why.',
  },
] as const;

export const FAQS = [
  {
    q: 'What is ViBe?',
    a: 'ViBe is a learning platform built around continuous assessment. You learn in short segments, answer checkpoint questions as you go, and review whenever an answer shows a gap.',
  },
  {
    q: 'Why is it called ViBe?',
    a: 'It is inspired by the Indian tale of Vikram and Betaal. Betaal challenges King Vikramaditya with riddles, and a wrong answer sends him back to try again — just as ViBe sends you back to review before you move on.',
  },
  {
    q: 'Who builds ViBe?',
    a: 'The Vicharanashala Lab for Education Design at IIT Ropar.',
  },
  {
    q: 'How do I join a course?',
    a: 'Through an invite or a registration link from your course team. Once you are enrolled, the course appears on your dashboard.',
  },
  {
    q: 'Can I learn on my phone?',
    a: 'Proctored courses need a laptop or desktop computer with a working camera and microphone.',
  },
  {
    q: 'What does proctoring record?',
    a: 'Only still images from your webcam, and only when an anomaly is detected. Audio is monitored during proctored lessons. You agree to this in the consent form before you begin.',
  },
  {
    q: 'What happens if I get a question wrong?',
    a: 'You review the related material and try again. The point is to make sure you understand it, not to catch you out.',
  },
] as const;
