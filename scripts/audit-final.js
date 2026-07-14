// Final defensible bug list (concrete, evidence-based):
//
// 🐛 F: CompanionWidget.tsx:118 - debug console.log in production
// 🐛 G: companionRenderer.js: - 3 console.warn for "unknown animal" fallbacks
// 🐛 H: CompanionWidget.tsx - selectAnimal error not caught, picker stays open
// 🐛 I: CompanionWidget.tsx - polls every 30s even when document.hidden
// 🐛 J: companion-store.ts - no concurrent fetch dedup
// 🐛 K: companion-store.ts - no AbortController for unmount safety
// 🐛 L: CompanionService.ts - selectAnimal doesn't validate animal parameter client-side (server does)
//
// Skip: M1/M2/M4/M5/L2/L4 (descriptions not preserved, can't act on labels alone)

console.log('Defensible bug list finalized.');