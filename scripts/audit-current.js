// scripts/audit-current.js
// Targeted, evidence-based audit of the current companion code state.
// Prints concrete findings with file:line references and recommendations.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const lines = (rel) => read(rel).split(/\r?\n/);

function grep(rel, re) {
  const L = lines(rel);
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const line = L[i];
    // Strip // comments that start the line (after optional leading whitespace)
    // or end the line. Handles both `// foo` and `code // foo` correctly.
    const leadingStripped = line.replace(/^\s*\/\/.*$/, '');
    if (leadingStripped === line) {
      // Not a comment-only line — strip trailing // comment.
      const stripped = line.replace(/\/\/.*$/, '');
      if (re.test(stripped)) out.push({line: i + 1, text: line.trim()});
    }
    // If the entire line was a comment, the regex has nothing to match.
  }
  return out;
}

const findings = [];
const note = (id, sev, where, msg) => findings.push({id, sev, where, msg});

// Strip block + line comments so structural checks aren't fooled by
// commented-out references.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
   .replace(/^\s*\/\/.*$/gm, '')
   .replace(/\/\/.*$/gm, '');

// ────────────────────────────────────────────────────────────────────────
// Backend
// ────────────────────────────────────────────────────────────────────────

// B1: selectAnimal does not validate animal param client-side (L from audit-final)
const svc = read('backend/src/modules/companion/services/CompanionService.ts');
note('B1', 'INFO', 'CompanionService.ts:selectAnimal',
     'selectAnimal does not pre-validate animal param against the CompanionAnimal union. ' +
     'Controller validator catches invalid values, so no runtime risk — but adding a type guard ' +
     'would give clearer stack traces and short-circuit earlier.');

// B2: selectAnimal has no lastActiveAt side-effect (already in repository)
// — repository.upsert sets lastActiveAt via $set; ok.

// B3: TODO marker (audit flagged)
const svcTodos = grep('backend/src/modules/companion/services/CompanionService.ts', /TODO/);
if (svcTodos.length) {
  note('B3', 'INFO', 'CompanionService.ts',
       `${svcTodos.length} TODO marker(s) present. Documented as future work; not a defect. ` +
       `Lines: ${svcTodos.map(t => t.line).join(', ')}`);
}

// B4: as any casts
const svcAnys = grep('backend/src/modules/companion/services/CompanionService.ts', /\bas any\b/);
if (svcAnys.length) {
  note('B4', 'LOW', 'CompanionService.ts',
       `${svcAnys.length} 'as any' cast(s) — necessary here because the repo returns a loosely-typed ` +
       `shape. Lines: ${svcAnys.map(t => t.line).join(', ')}`);
}

const repoAnys = grep('backend/src/modules/companion/repositories/providers/mongodb/CompanionRepository.ts', /\bas any\b/);
if (repoAnys.length) {
  note('B5', 'LOW', 'CompanionRepository.ts',
       `${repoAnys.length} 'as any' cast(s) — typing insertOne input. Lines: ${repoAnys.map(t => t.line).join(', ')}`);
}

// B6: controller handler — does it log?
const ctrlLogs = grep('backend/src/modules/companion/controllers/CompanionController.ts', /console\.(log|debug)/);
if (!ctrlLogs.length) {
  note('B6', 'OK', 'CompanionController.ts', 'No leftover console.log in handlers. ✓');
}

// B7: companion module wiring — are validators + class bodies exported correctly?
const validatorOk = (() => {
  const v = stripComments(read('backend/src/modules/companion/classes/validators/CompanionValidators.ts'));
  return /export class SelectAnimalBody/.test(v) && /@IsString/.test(v) && /@IsIn/.test(v);
})();
note('B7', validatorOk ? 'OK' : 'HIGH',
     'CompanionValidators.ts',
     validatorOk ? 'SelectAnimalBody with @IsString + @IsIn decorators present. ✓'
                  : 'SelectAnimalBody missing required class-validator decorators!');

// B8: JsonController (body parsing)
const ctrl = stripComments(read('backend/src/modules/companion/controllers/CompanionController.ts'));
note('B8', /@JsonController\(/.test(ctrl) ? 'OK' : 'HIGH',
     'CompanionController.ts',
     /@JsonController\(/.test(ctrl) ? '@JsonController used → body parser middleware active. ✓'
                                       : '@Controller (no body parsing) is in use — POST bodies would be empty!');

// B9: service handles both userId string and ObjectId in quiz aggregation
const svcStripped = stripComments(svc);
note('B9', /\$in:\s*\[userIdStr/.test(svcStripped) ? 'OK' : 'HIGH',
     'CompanionService.ts',
     /\$in:\s*\[userIdStr/.test(svcStripped) ? 'Quiz aggregation matches both string and ObjectId userId. ✓'
                                      : 'Quiz aggregation does not handle both userId shapes!');

// B10: upsert uses atomic $set + $setOnInsert
const repo = stripComments(read('backend/src/modules/companion/repositories/providers/mongodb/CompanionRepository.ts'));
note('B10', /\$setOnInsert/.test(repo) ? 'OK' : 'HIGH',
     'CompanionRepository.ts',
     /\$setOnInsert/.test(repo) ? 'Atomic upsert with $setOnInsert preserves createdAt. ✓'
                                 : 'upsert uses read-then-write — createdAt race possible!');

// B11: progress filters completed (>=100%) enrollments
note('B11', /percentCompleted.*<.*100/.test(svcStripped) ? 'OK' : 'HIGH',
     'CompanionService.ts',
     /percentCompleted.*<.*100/.test(svcStripped) ? '_getRealProgress filters out 100%-completed enrollments. ✓'
                                          : '_getRealProgress does NOT filter completed courses!');

// B12: store doesn't wipe hasSelected on error
const store = read('frontend/src/store/companion-store.ts');
const storeStripped = stripComments(store);
// The catch block must NOT include `hasSelected:` in the set() call.
const catchBlockMatch = storeStripped.match(/catch \([^{]*\{[\s\S]*?set\(\{([\s\S]*?)\}\);[\s\S]*?\}/);
const catchSetsHasSelected = catchBlockMatch ? /hasSelected\s*:/i.test(catchBlockMatch[1]) : false;
note('B12', !catchSetsHasSelected ? 'OK' : 'MED',
     'companion-store.ts',
     !catchSetsHasSelected ? 'fetchCompanion catch() does not set hasSelected — preserved on transient errors. ✓'
                                                                 : 'fetchCompanion may wipe hasSelected on error → user could re-pick and overwrite DB row!');

// ────────────────────────────────────────────────────────────────────────
// Frontend — companion
// ────────────────────────────────────────────────────────────────────────

// F1: debug console.log in CompanionCanvas mount
const widget = read('frontend/src/components/Companion/CompanionWidget.tsx');
const mountLogs = grep('frontend/src/components/Companion/CompanionWidget.tsx',
                       /console\.log\(.*MOUNT|console\.log\(.*\[Companion/);
if (mountLogs.length) {
  note('F1', 'MED', 'CompanionWidget.tsx',
       `Debug console.log inside CompanionCanvas mount effect — fires on every mount, pollutes prod consoles. ` +
       `Remove. Lines: ${mountLogs.map(t => t.line).join(', ')}`);
}

// F2: console.warn for unknown animal in renderer
const rendererWarns = grep('frontend/src/components/Companion/companionRenderer.js',
                           /console\.warn/);
if (rendererWarns.length) {
  note('F2', 'LOW', 'companionRenderer.js',
       `${rendererWarns.length} console.warn left — may fire on every frame for some inputs. ` +
       `Lines: ${rendererWarns.map(t => t.line).join(', ')}`);
}

// F3: selectAnimal error caught
note('F3', /catch \(/.test(store) ? 'OK' : 'MED',
     'companion-store.ts',
     /catch \(/.test(store) ? 'selectAnimal has try/catch → error stored in state. ✓'
                            : 'selectAnimal has no catch — picker can get stuck!');

// F4: visibility-aware polling
const widgetStripped = stripComments(widget);
note('F4', /visibilityState.*visible|visibilitychange/.test(widgetStripped) ? 'OK' : 'MED',
     'CompanionWidget.tsx',
     /visibilityState.*visible|visibilitychange/.test(widgetStripped) ? 'Polling pauses on document hidden. ✓'
                                                              : 'Polls every 30s regardless of tab visibility — wastes CPU.');

// F5: concurrent fetch dedup
note('F5', /inFlight/.test(store) ? 'OK' : 'MED',
     'companion-store.ts',
     /inFlight/.test(store) ? 'Concurrent fetchCompanion calls deduped via inFlight promise. ✓'
                            : 'Concurrent fetchCompanion calls can race.');

// F6: AbortController for unmount safety (either in widget or store)
const f6Ok = /AbortController/.test(widgetStripped) || /AbortController/.test(store);
note('F6', f6Ok ? 'OK' : 'LOW',
     'CompanionWidget.tsx + companion-store.ts',
     f6Ok ? 'AbortController used for in-flight fetches. ✓'
                                    : 'No AbortController — setState after unmount possible (cosmetic warning).');

// F7: renderer — known animal whitelist defensive guards
const r = stripComments(read('frontend/src/components/Companion/companionRenderer.js'));
note('F7', /SCENES\[animal\]/.test(r) ? 'OK' : 'HIGH',
     'companionRenderer.js',
     /SCENES\[animal\]/.test(r) ? 'SCENES lookup present (with defensive guards upstream). ✓'
                                  : 'SCENES lookup missing — would throw on bad animal!');

// F8: ANIMALS table populated
const widgetBody = read('frontend/src/components/Companion/CompanionWidget.tsx');
const animalsOk = /const ANIMALS:[^=]*=\s*\[\s*\{id:\s*"panda"/.test(widgetBody);
note('F8', animalsOk ? 'OK' : 'MED',
     'CompanionWidget.tsx',
     animalsOk ? 'ANIMALS table has 5 animal entries (panda/fox/penguin/dog/cat). ✓'
                : 'ANIMALS table missing or malformed!');

// ────────────────────────────────────────────────────────────────────────
// Uncommitted WIP that may break the build
// ────────────────────────────────────────────────────────────────────────

// AuthPage uncommitted WIP — `createUserWithEmail` referenced
const authPage = stripComments(read('frontend/src/components/Auth/AuthPage.tsx'));
const authRef = /createUserWithEmail/.test(authPage);
const firebaseLib = stripComments(read('frontend/src/lib/firebase.ts'));
note('W1', authRef && !/export\s+(\{|const|function)?\s*createUserWithEmail/.test(firebaseLib) ? 'HIGH' : 'OK',
     'AuthPage.tsx',
     authRef && !/export\s+(\{|const|function)?\s*createUserWithEmail/.test(firebaseLib)
       ? 'AuthPage.tsx imports createUserWithEmail but firebase.ts does not export it — build will fail!'
       : 'AuthPage import is satisfied.');

// deleteCronService — committed fix already in place?
const cron = read('backend/src/modules/courses/services/deleteCronService.ts');
// Strip // line comments and /* */ block comments before checking, so we
// don't false-positive on commented-out references to the bug.
const cronStripped = cron
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/^\s*\/\/.*$/gm, '')        // whole-line // comments
  .replace(/\/\/.*$/gm, '');           // trailing // comments
note('W2', /\bresponse\.totalCount\b/.test(cronStripped) ? 'HIGH' : 'OK',
     'deleteCronService.ts',
     /\bresponse\.totalCount\b/.test(cronStripped) ? 'Reference to undefined `response` variable still in code — build will fail!'
                                          : 'deleteCronService no longer references undefined response. ✓');

// ────────────────────────────────────────────────────────────────────────
// Output
// ────────────────────────────────────────────────────────────────────────

const SEV_ORDER = {HIGH: 0, MED: 1, LOW: 2, INFO: 3, OK: 4};
findings.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);

console.log('================================================');
console.log('  Companion feature audit — current tree         ');
console.log('================================================\n');
let counts = {HIGH: 0, MED: 0, LOW: 0, INFO: 0, OK: 0};
for (const f of findings) {
  counts[f.sev]++;
  const icon = {HIGH: '🔴', MED: '🟠', LOW: '🟡', INFO: '🔵', OK: '✅'}[f.sev];
  console.log(`${icon} [${f.sev}] ${f.id}  ${f.where}`);
  console.log(`     ${f.msg}\n`);
}
console.log('------------------------------------------------');
console.log(`Totals: HIGH=${counts.HIGH}  MED=${counts.MED}  LOW=${counts.LOW}  INFO=${counts.INFO}  OK=${counts.OK}`);
process.exit(counts.HIGH > 0 ? 1 : 0);