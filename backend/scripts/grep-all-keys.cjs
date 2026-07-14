#!/usr/bin/env node
// grep-all-keys.cjs — find ALL map()/SidebarMenuSub usages and key props nearby
const fs = require('fs');
const path = 'C:/Users/openclaw-user/Projects/vibe/frontend/src/app/pages/student/course-page.tsx';
const txt = fs.readFileSync(path, 'utf8');
const lines = txt.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('.map(') || l.includes('SidebarMenuSub') || l.includes('SidebarMenuSubItem') || l.includes('<SidebarMenuButton')) {
    console.log(`${i+1}: ${l.trim().slice(0, 140)}`);
  }
}