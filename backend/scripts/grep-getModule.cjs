#!/usr/bin/env node
// grep-getModule.cjs — find getModuleWiseProgress in ProgressService.ts

const fs = require('fs');
const path = 'C:/Users/openclaw-user/Projects/vibe/backend/src/modules/users/services/ProgressService.ts';
const txt = fs.readFileSync(path, 'utf8');
const lines = txt.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('getModuleWiseProgress')) {
    console.log(`line ${i + 1}: ${lines[i]}`);
  }
}