// Fresh audit script — read each companion file fully and look for real issues
const fs = require('fs');

function check(name, body, checks) {
  console.log('\n=== ' + name + ' ===');
  for (const c of checks) {
    const result = c.check(body);
    console.log(`  ${result.found ? '🔴' : '✅'} ${c.label}` + (result.detail ? ': ' + result.detail : ''));
  }
}

const allChecks = {
  companionStore: [
    {label: 'no "any" type for errors (use unknown)', check: b => /catch \(err: any\)/.test(b)},
    {label: 'no console.error for logging', check: b => /console\.error\(/.test(b)},
    {label: 'no AbortController for fetch cleanup', check: b => !/AbortController/.test(b)},
  ],
  companionWidget: [
    {label: 'no setInterval when document hidden (Page Visibility API)', check: b => !/visibilitychange|hidden/.test(b)},
    {label: 'no clearInterval cleanup', check: b => /clearInterval/.test(b)},
    {label: 'no eslint-disable comments', check: b => !/eslint-disable/.test(b)},
    {label: 'no duplicate style blocks', check: b => /background: ['"]red['"]/.test(b)},
    {label: 'no hardcoded fallback animal (should error?)', check: b => /animal = 'panda'/.test(b)},
  ],
  companionService: [
    {label: 'no leftover TODO marker', check: b => /TODO/.test(b)},
    {label: 'uses any type casts', check: b => /as any/.test(b)},
  ],
  companionController: [
    {label: 'no console.log left in handler', check: b => /console\.log\(/.test(b)},
    {label: 'no return type void missing', check: b => !/Promise<ICompanion>/.test(b)},
  ],
};

for (const file of [
  'frontend/src/store/companion-store.ts',
  'frontend/src/components/Companion/CompanionWidget.tsx',
  'backend/src/modules/companion/services/CompanionService.ts',
  'backend/src/modules/companion/controllers/CompanionController.ts',
  'frontend/src/components/Companion/companionRenderer.js',
]) {
  const body = fs.readFileSync(file, 'utf8');
  check(file, body, allChecks.companionStore || []);
}
console.log('\n--- Widget specific ---');
const widget = fs.readFileSync('frontend/src/components/Companion/CompanionWidget.tsx', 'utf8');
for (const c of allChecks.companionWidget) {
  const result = c.check(widget);
  // For widget: label says "no BUG" means bug IS present. Invert logic.
  // The check functions return {found: true} if the bug-indicating pattern is found
  // OR if a beneficial pattern is missing. We need consistent semantics.
  const isBug = result.found; // found = bug present
  console.log(`  ${isBug ? '🔴' : '✅'} ${c.label}`);
}
console.log('\n--- Service specific ---');
const svc = fs.readFileSync('backend/src/modules/companion/services/CompanionService.ts', 'utf8');
for (const c of allChecks.companionService) {
  const result = c.check(svc);
  console.log(`  ${result.found ? '🔴' : '✅'} ${c.label}` + (result.detail ? ': ' + result.detail : ''));
}
console.log('\n--- Controller specific ---');
const ctrl = fs.readFileSync('backend/src/modules/companion/controllers/CompanionController.ts', 'utf8');
for (const c of allChecks.companionController) {
  const result = c.check(ctrl);
  console.log(`  ${result.found ? '🔴' : '✅'} ${c.label}` + (result.detail ? ': ' + result.detail : ''));
}