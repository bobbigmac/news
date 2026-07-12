import { watchSync } from 'fs';
import { execSync } from 'child_process';

const dirs = ['src'];

for (const dir of dirs) {
  watchSync(dir, { recursive: true }, (event, filename) => {
    if (!filename) return;
    console.log(`\n[${new Date().toLocaleTimeString()}] ${event}: ${dir}/${filename} — rebuilding...`);
    try {
      execSync('node scripts/build.js', { stdio: 'inherit' });
    } catch {
      console.error('Build failed.');
    }
  });
}

console.log('Watching src/ for changes. Ctrl+C to stop.');
