import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('build output boundary', () => {
  it('uses dist for the Vite bundle, publish data, and Pages artifact', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toContain("outDir: '../dist'");
    expect(readFileSync('scripts/build.js', 'utf8')).toContain("const OUT_DIR = 'dist'");
    expect(readFileSync('.github/workflows/deploy.yml', 'utf8')).toContain('path: ./dist');
  });

  it('keeps generated site files out of docs', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('dist/');
    expect(gitignore).toContain('docs/index.html');
    expect(gitignore).toContain('docs/digest.json');
    expect(gitignore).not.toMatch(/^docs\/$/m);
  });
});
