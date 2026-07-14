// Fresh audit: read every companion file and look for real bugs/cleanup
const fs = require('fs');
const path = require('path');

const FILES = [
  'frontend/src/store/companion-store.ts',
  'frontend/src/components/Companion/CompanionWidget.tsx',
  'frontend/src/components/Companion/companionRenderer.js',
  'frontend/src/components/Companion/companionRenderer.d.ts',
  'frontend/src/types/companion.ts',
  'frontend/src/app/pages/student/dashboard.tsx',
  'backend/src/modules/companion/index.ts',
  'backend/src/modules/companion/container.ts',
  'backend/src/modules/companion/types.ts',
  'backend/src/modules/companion/classes/Companion.ts',
  'backend/src/modules/companion/classes/interfaces.ts',
  'backend/src/modules/companion/classes/validators/CompanionValidators.ts',
  'backend/src/modules/companion/controllers/CompanionController.ts',
  'backend/src/modules/companion/services/CompanionService.ts',
  'backend/src/modules/companion/repositories/providers/mongodb/CompanionRepository.ts',
];

for (const f of FILES) {
  console.log('=== ' + f + ' ===');
  const txt = fs.readFileSync(f, 'utf8');
  console.log('  Lines:', txt.split('\n').length);
  // Quick smells
  if (txt.includes('TODO')) console.log('  has TODO');
  if (txt.includes('FIXME')) console.log('  has FIXME');
  if (txt.includes('console.log') && !txt.includes('console.log("[Companion')) console.log('  has console.log');
  if (/eslint-disable/.test(txt)) console.log('  has eslint-disable');
  if (txt.includes('any')) console.log('  uses any');
  console.log();
}