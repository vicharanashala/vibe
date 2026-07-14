#!/usr/bin/env node
// grep-sidebar-keys.cjs
const fs = require('fs');
const path = 'C:/Users/openclaw-user/Projects/vibe/frontend/src/app/pages/student/course-page.tsx';
const txt = fs.readFileSync(path, 'utf8');
const lines = txt.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SidebarMenuSub') || lines[i].includes('SidebarMenuSubItem') || lines[i].includes('SidebarMenuSubButton')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}